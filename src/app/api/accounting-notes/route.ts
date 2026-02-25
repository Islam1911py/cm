import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"

// GET /api/accounting-notes - List accounting notes (Inbox for Accountant)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const status = searchParams.get("status")
    const projectId = searchParams.get("projectId")

    const filters: any[] = []

    if (status) {
      filters.push({ status })
    }

    if (projectId) {
      filters.push({ projectId })
    }

    if (session.user.role === "PROJECT_MANAGER") {
      const assignedProjectIds = session.user.projectIds || []

      if (!session.user.canViewAllProjects) {
        if (projectId && !assignedProjectIds.includes(projectId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        if (assignedProjectIds.length === 0) {
          // No project assignments — only show notes created directly by this user
          filters.push({ createdByUserId: session.user.id })
        } else {
          filters.push({
            OR: [
              { createdByUserId: session.user.id },
              { projectId: { in: assignedProjectIds } }
            ]
          })
        }
      }
    } else if (session.user.role !== "ACCOUNTANT" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const where = filters.length > 0 ? { AND: filters } : undefined

    // Fetch accounting notes with relations
    const notes = await prisma.accountingNote.findMany({
      where,
      include: {
        unit: {
          include: {
            project: true
          }
        },
        project: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        convertedToExpense: {
          include: {
            recordedByUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        pmAdvance: {
          include: {
            staff: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error("Error fetching accounting notes:", error)
    return NextResponse.json(
      { error: "Failed to fetch accounting notes" },
      { status: 500 }
    )
  }
}

// POST /api/accounting-notes - Create accounting note (PM creates from field)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Project Managers and Admin can create accounting notes
    if (session.user.role !== "PROJECT_MANAGER" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const {
      projectId,
      unitId,
      description,
      amount,
      sourceType = "OFFICE_FUND",
      pmAdvanceId
    } = body

    const normalizedDescription = typeof description === "string" ? description.trim() : ""
    const parsedAmount = Number(amount)

    // Validate required fields
    if (!projectId || !unitId || !normalizedDescription || parsedAmount <= 0 || Number.isNaN(parsedAmount)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    if (sourceType !== "OFFICE_FUND" && sourceType !== "PM_ADVANCE") {
      return NextResponse.json(
        { error: "Invalid source type. Must be OFFICE_FUND or PM_ADVANCE" },
        { status: 400 }
      )
    }

    if (sourceType === "PM_ADVANCE" && !pmAdvanceId) {
      return NextResponse.json(
        { error: "pmAdvanceId is required when sourceType is PM_ADVANCE" },
        { status: 400 }
      )
    }

    // Get operational unit to validate it belongs to project
    const unit = await prisma.operationalUnit.findUnique({
      where: { id: unitId },
      include: { project: true }
    })

    if (!unit) {
      return NextResponse.json(
        { error: "Operational unit not found" },
        { status: 404 }
      )
    }

    if (unit.projectId !== projectId) {
      return NextResponse.json(
        { error: "Unit does not belong to the specified project" },
        { status: 400 }
      )
    }

    // Check if PM is assigned to this project (if PROJECT_MANAGER role)
    if (session.user.role === "PROJECT_MANAGER") {
      const assignment = await prisma.projectAssignment.findFirst({
        where: {
          userId: session.user.id,
          projectId: projectId
        }
      })

      if (!assignment) {
        return NextResponse.json(
          { error: "You are not assigned to this project" },
          { status: 403 }
        )
      }
    }

    if (sourceType === "PM_ADVANCE" && pmAdvanceId) {
      const advance = await prisma.pMAdvance.findUnique({
        where: { id: pmAdvanceId }
      })

      if (!advance) {
        return NextResponse.json({ error: "PM Advance not found" }, { status: 404 })
      }
    }

    // Create accounting note
    const accountingNote = await prisma.accountingNote.create({
      data: {
        projectId,
        unitId,
        createdByUserId: session.user.id,
        description: normalizedDescription,
        amount: parsedAmount,
        status: "PENDING",
        sourceType,
        pmAdvanceId: sourceType === "PM_ADVANCE" ? pmAdvanceId : null
      },
      include: {
        unit: {
          include: {
            project: true
          }
        },
        project: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        pmAdvance: {
          include: {
            staff: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })

    return NextResponse.json(accountingNote, { status: 201 })
  } catch (error) {
    console.error("Error creating accounting note:", error)
    return NextResponse.json(
      { error: "Failed to create accounting note" },
      { status: 500 }
    )
  }
}

// PATCH /api/accounting-notes?id=xxx - Record/Convert accounting note to invoice
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Accountant and Admin can record (convert) notes
    if (session.user.role !== "ACCOUNTANT" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { noteId, sourceType, pmAdvanceId } = body

    if (!noteId) {
      return NextResponse.json(
        { error: "Missing required field: noteId" },
        { status: 400 }
      )
    }

    // Fetch accounting note
    const note = await prisma.accountingNote.findUnique({
      where: { id: noteId },
      include: {
        unit: {
          include: { project: true }
        },
        project: true,
        convertedToExpense: {
          include: {
            recordedByUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        pmAdvance: true
      }
    })

    if (!note) {
      console.error("❌ Note not found:", noteId)
      return NextResponse.json({ error: "Accounting note not found" }, { status: 404 })
    }

    console.log("✓ Note found:", { id: note.id, status: note.status, amount: note.amount, unitId: note.unitId, projectId: note.projectId })

    if (note.status !== "PENDING") {
      console.error("❌ Note already recorded:", note.status)
      return NextResponse.json(
        { error: "This note has already been recorded", status: note.status },
        { status: 400 }
      )
    }

    const resolvedSourceType = sourceType ?? note.sourceType
    const resolvedPmAdvanceId = pmAdvanceId ?? note.pmAdvanceId

    if (resolvedSourceType !== "OFFICE_FUND" && resolvedSourceType !== "PM_ADVANCE") {
      return NextResponse.json(
        { error: "Invalid source type" },
        { status: 400 }
      )
    }

    if (resolvedSourceType === "PM_ADVANCE" && !resolvedPmAdvanceId) {
      return NextResponse.json(
        { error: "PM advance is required when source type is PM_ADVANCE" },
        { status: 400 }
      )
    }

    // Validate PM Advance if sourceType is PM_ADVANCE
    if (resolvedSourceType === "PM_ADVANCE" && resolvedPmAdvanceId) {
      const pmAdvance = await prisma.pMAdvance.findUnique({
        where: { id: resolvedPmAdvanceId }
      })

      if (!pmAdvance) {
        console.error("❌ PM Advance not found:", resolvedPmAdvanceId)
        return NextResponse.json({ error: "PM Advance not found" }, { status: 404 })
      }

      if (pmAdvance.remainingAmount < note.amount) {
        console.error("❌ Insufficient balance:", { remaining: pmAdvance.remainingAmount, needed: note.amount })
        return NextResponse.json(
          { error: "Insufficient PM Advance balance", remaining: pmAdvance.remainingAmount, needed: note.amount },
          { status: 400 }
        )
      }
      console.log("✓ PM Advance validated:", { id: resolvedPmAdvanceId, remaining: pmAdvance.remainingAmount })
    } else if (resolvedSourceType === "PM_ADVANCE" && !resolvedPmAdvanceId) {
      console.warn("⚠ PM_ADVANCE selected but no pmAdvanceId provided")
    }

    // Get or create owner association for this unit
    let ownerAssociation = await prisma.ownerAssociation.findFirst({
      where: { unitId: note.unitId }
    })

    if (!ownerAssociation) {
      console.log("🔨 Creating new owner association for unit:", note.unitId)
      ownerAssociation = await prisma.ownerAssociation.create({
        data: {
          name: `Owner - ${note.unit.name}`,
          unitId: note.unitId,
          phone: "",
          email: ""
        }
      })
      console.log("✓ Owner association created:", ownerAssociation.id)
    } else {
      console.log("✓ Owner association found:", ownerAssociation.id)
    }

    // Reuse existing open (unpaid) CLAIM invoice if one exists for this unit,
    // otherwise create a new one.
    let invoice = await prisma.invoice.findFirst({
      where: {
        unitId: note.unitId,
        type: "CLAIM",
        isPaid: false
      },
      orderBy: { issuedAt: "desc" }
    })

    if (invoice) {
      // Add the note amount to the existing open invoice
      console.log("♻️ Reusing existing open invoice:", { id: invoice.id, invoiceNumber: invoice.invoiceNumber })
      invoice = await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          amount: { increment: note.amount },
          remainingBalance: { increment: note.amount }
        }
      })
      console.log("✓ Invoice updated:", { id: invoice.id, newAmount: invoice.amount })
    } else {
      // No open invoice — create a fresh one
      const invoiceNumber = `CLM-${Date.now()}-${note.unit.code}`
      console.log("🔨 Creating new invoice:", invoiceNumber)
      invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          type: "CLAIM",
          unitId: note.unitId,
          ownerAssociationId: ownerAssociation.id,
          amount: note.amount,
          remainingBalance: note.amount
        }
      })
      console.log("✓ New invoice created:", { id: invoice.id, invoiceNumber, amount: invoice.amount })
    }

    // Create operational expense record
    console.log("🔨 Creating operational expense")
    const expense = await prisma.operationalExpense.create({
      data: {
        description: note.description,
        amount: note.amount,
        sourceType: resolvedSourceType,
        unitId: note.unitId,
        claimInvoiceId: invoice.id,
        recordedByUserId: session.user.id,
        pmAdvanceId: resolvedSourceType === "PM_ADVANCE" ? resolvedPmAdvanceId : null,
        convertedFromNoteId: noteId  // Link back to the accounting note
      }
    })
    console.log("✓ Operational expense created:", { id: expense.id, sourceType: resolvedSourceType, amount: expense.amount })

    // Deduct from PM Advance if applicable
    if (resolvedSourceType === "PM_ADVANCE" && resolvedPmAdvanceId) {
      console.log("💰 Deducting from PM Advance:", { pmAdvanceId: resolvedPmAdvanceId, amount: note.amount })
      await prisma.pMAdvance.update({
        where: { id: resolvedPmAdvanceId },
        data: {
          remainingAmount: {
            decrement: note.amount
          }
        }
      })
      console.log("✓ PM Advance deducted successfully")
    }

    // Update accounting note status
    console.log("🔨 Updating note status to CONVERTED")
    await prisma.accountingNote.update({
      where: { id: noteId },
      data: {
        status: "CONVERTED",
        convertedToExpenseId: expense.id,
        convertedAt: new Date(),
        pmAdvanceId: resolvedSourceType === "PM_ADVANCE" ? resolvedPmAdvanceId : null,
        sourceType: resolvedSourceType
      }
    })
    console.log("✓ Note updated to CONVERTED")

    return NextResponse.json({
      success: true,
      message: "✓ Accounting note recorded successfully. Invoice created.",
      invoice,
      expense,
      invoiceNumber: invoice.invoiceNumber
    })
  } catch (error) {
    console.error("❌ Error recording accounting note:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Failed to record accounting note", details: errorMessage },
      { status: 500 }
    )
  }
}
