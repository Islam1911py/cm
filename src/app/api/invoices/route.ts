import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const prisma = db as any

/** إنشاء فاتورة خدمات شهرية واحدة لكل مشروع له وحدات يوم التحصيل فيها = يوم اليوم */
async function ensureMonthlyServiceInvoicesForToday() {
  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.toISOString().substring(0, 7)

  const unitsToInvoice = await db.operationalUnit.findMany({
    where: {
      isActive: true,
      monthlyBillingDay: currentDay
    },
    include: { project: true }
  })

  const byProject = new Map<string, { project: { id: string; name: string }; totalAmount: number }>()
  for (const unit of unitsToInvoice) {
    const fee = unit.monthlyManagementFee ?? 0
    if (fee <= 0) continue
    const pid = unit.projectId
    if (!byProject.has(pid)) {
      byProject.set(pid, { project: unit.project, totalAmount: 0 })
    }
    const entry = byProject.get(pid)!
    entry.totalAmount += fee
  }

  for (const [, { project, totalAmount }] of byProject) {
    const invoiceNumber = `MGT-${currentMonth}-${project.id.slice(0, 8)}`
    const existing = await db.invoice.findFirst({
      where: { projectId: project.id, invoiceNumber }
    })
    if (existing) continue

    try {
      await db.invoice.create({
        data: {
          invoiceNumber,
          type: "MANAGEMENT_SERVICE",
          amount: totalAmount,
          projectId: project.id,
          unitId: null,
          ownerAssociationId: null,
          issuedAt: today,
          totalPaid: 0,
          remainingBalance: totalAmount,
          isPaid: false
        }
      })
    } catch {
      // تكرار أو خطأ — نتجاهل
    }
  }
}

// GET /api/invoices - List all invoices with their expenses
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      console.log("No session found")
      return NextResponse.json({ error: "Unauthorized: No session" }, { status: 401 })
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      console.log("User role:", session.user.role)
      return NextResponse.json({ error: "Unauthorized: Insufficient permissions" }, { status: 403 })
    }

    await ensureMonthlyServiceInvoicesForToday()

    const { searchParams } = new URL(req.url)
    const unitId = searchParams.get("unitId")
    const isPaidParam = searchParams.get("isPaid")

    // Build where clause
    const where: any = {}
    if (unitId) {
      where.unitId = unitId
    }
    if (isPaidParam !== null) {
      where.isPaid = isPaidParam === "true"
    }

    // Get all invoices with their associated data (وحدة أو مشروع)
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        unit: {
          include: {
            project: true
          }
        },
        project: true,
        ownerAssociation: {
          include: {
            contacts: {
              orderBy: { createdAt: "asc" }
            }
          }
        },
        expenses: {
          select: {
            id: true,
            description: true,
            amount: true,
            sourceType: true,
            date: true,
            createdAt: true,
            unitId: true,
            unit: { select: { name: true, code: true } }
          }
        },
        operationalExpenses: {
          select: {
            id: true,
            description: true,
            amount: true,
            sourceType: true,
            recordedAt: true,
            createdAt: true,
            unitId: true,
            unit: { select: { name: true, code: true } }
          }
        },
        payments: {
          select: {
            id: true,
            amount: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { issuedAt: "desc" }
    })

    const normalized = invoices.map((invoice) => {
      const unitExpenses = (invoice.expenses ?? []).map((expense: any) => ({
        ...expense,
        date: expense.date ?? expense.createdAt ?? null,
        createdAt: expense.createdAt ?? null,
        sourceType: expense.sourceType ?? "UNIT_EXPENSE",
        unitName: expense.unit?.name ?? null,
        unitCode: expense.unit?.code ?? null
      }))

      const operationalExpenses = (invoice.operationalExpenses ?? []).map((expense: any) => ({
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        sourceType: expense.sourceType,
        date: expense.recordedAt ?? expense.createdAt ?? null,
        createdAt: expense.createdAt ?? null,
        unitName: expense.unit?.name ?? null,
        unitCode: expense.unit?.code ?? null
      }))

      const mergedExpenses = [...unitExpenses, ...operationalExpenses].sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0
        const bTime = b.date ? new Date(b.date).getTime() : 0
        return bTime - aTime
      })

      const {
        operationalExpenses: _op,
        expenses: _unitExpenses,
        payments: _payments,
        ownerAssociation: rawOwnerAssociation,
        project: invoiceProject,
        ...rest
      } = invoice

      const ownerContacts = rawOwnerAssociation?.contacts ?? []
      const primaryPhone = ownerContacts.find(
        (contact: any) => contact.type === "PHONE" && contact.isPrimary
      )?.value
      const primaryEmail = ownerContacts.find(
        (contact: any) => contact.type === "EMAIL" && contact.isPrimary
      )?.value

      const ownerAssociation = rawOwnerAssociation
        ? {
            ...rawOwnerAssociation,
            phone: primaryPhone ?? rawOwnerAssociation.phone ?? null,
            email: primaryEmail ?? rawOwnerAssociation.email ?? null,
            contacts: ownerContacts
          }
        : null

      return {
        ...rest,
        project: invoiceProject,
        expenses: mergedExpenses,
        payments: invoice.payments ?? [],
        ownerAssociation
      }
    })

    return NextResponse.json(normalized)
  } catch (error) {
    console.error("Error fetching invoices:", error)
    return NextResponse.json({ error: "Failed to fetch invoices", details: String(error) }, { status: 500 })
  }
}
