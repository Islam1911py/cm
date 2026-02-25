import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const resolvedParams = typeof (params as any)?.then === "function" ? await params : params
    const payrollId = resolvedParams?.id

    if (!payrollId || payrollId === "undefined") {
      return NextResponse.json({ error: "Payroll ID is required" }, { status: 400 })
    }
    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get("staffId")

    if (!staffId || staffId === "undefined") {
      return NextResponse.json({ error: "Staff ID is required" }, { status: 400 })
    }

    // @ts-ignore - Prisma model exists at runtime
    const payroll = await db.payroll.findUnique({
      where: { id: payrollId },
      include: {
        payrollItems: {
          where: { staffId },
        },
        createdByUser: {
          select: { id: true, name: true },
        },
      },
    })

    if (!payroll) {
      return NextResponse.json({ error: "Payroll not found" }, { status: 404 })
    }

    const payrollItem = payroll.payrollItems[0]

    if (!payrollItem) {
      return NextResponse.json(
        { error: "Staff member not part of this payroll" },
        { status: 404 }
      )
    }

    const staff = await db.staff.findUnique({
      where: { id: staffId },
      include: {
        unit: {
          select: {
            id: true,
            name: true,
            code: true,
            project: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    // All pending advances contribute to the net amount until payroll is paid
    const pendingAdvances = await db.staffAdvance.findMany({
      where: {
        staffId,
        status: "PENDING",
      },
      orderBy: { date: "asc" },
    })

    // Any advances already deducted via this payroll
    const deductedAdvances = await db.staffAdvance.findMany({
      where: {
        staffId,
        deductedFromPayrollId: payrollId,
      },
      orderBy: { date: "asc" },
    })

    const salary = payrollItem.salary ?? staff.salary ?? 0
    const pendingTotal = pendingAdvances.reduce((sum: number, adv: any) => sum + adv.amount, 0)
    const deductedTotal = deductedAdvances.reduce((sum: number, adv: any) => sum + adv.amount, 0)

    const advancesTotal = payroll.status === "PAID" ? deductedTotal : pendingTotal
    const netAmount = salary - advancesTotal

    const currency = staff.currency || "EGP"

    return NextResponse.json({
      payroll: {
        id: payroll.id,
        month: payroll.month,
        status: payroll.status,
        paidAt: payroll.paidAt,
        createdAt: payroll.createdAt,
        createdBy: payroll.createdByUser,
      },
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        type: staff.type,
        phone: staff.phone,
        salary,
        paymentDay: staff.paymentDay,
        currency,
        unit: staff.unit,
      },
      totals: {
        baseSalary: salary,
        advances: advancesTotal,
        pendingAdvances: pendingTotal,
        deductedAdvances: deductedTotal,
        net: netAmount,
      },
      pendingAdvances: pendingAdvances.map((advance) => ({
        id: advance.id,
        amount: advance.amount,
        date: advance.date,
        note: advance.note,
        status: advance.status,
      })),
      deductedAdvances: deductedAdvances.map((advance) => ({
        id: advance.id,
        amount: advance.amount,
        date: advance.date,
        note: advance.note,
        status: advance.status,
      })),
      currency,
    })
  } catch (error) {
    console.error("[PAYROLL_STAFF_STATEMENT]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
