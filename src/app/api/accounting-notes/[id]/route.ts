import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  convertAccountingNote,
  AccountingNoteAlreadyProcessedError,
  AccountingNoteMissingUnitError,
  AccountingNoteNotFoundError,
  AccountingNotePmAdvanceInsufficientError,
  AccountingNotePmAdvanceNotFoundError,
  AccountingNotePmAdvanceRequiredError
} from "@/lib/accounting-note-conversion"

// GET /api/accounting-notes/[id] - Get single accounting note
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const normalizedId = id?.toString().trim()
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!normalizedId) {
      return NextResponse.json({ error: "Invalid accounting note id" }, { status: 400 })
    }

    const role = session.user.role as string

    const note = await db.accountingNote.findUnique({
      where: { id: normalizedId },
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
      }
    })

    if (!note) {
      return NextResponse.json({ error: "Accounting note not found" }, { status: 404 })
    }

    // Check if user has access to this note
    if (role === "PROJECT_MANAGER") {
      // PMs can only see notes from their assigned projects
      const assignments = await db.projectAssignment.findMany({
        where: { userId: session.user.id },
        select: { projectId: true }
      })
      const projectIds = assignments.map(a => a.projectId)
      
      if (!projectIds.includes(note.unit.projectId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    return NextResponse.json(note)
  } catch (error) {
    console.error("Error fetching accounting note:", error)
    return NextResponse.json(
      { error: "Failed to fetch accounting note" },
      { status: 500 }
    )
  }
}

// PATCH /api/accounting-notes/[id] - Update accounting note (record it)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const normalizedId = id?.toString().trim()
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!normalizedId) {
      return NextResponse.json({ error: "Invalid accounting note id" }, { status: 400 })
    }

    const role = session.user.role as string
    const userId = session.user.id

    // Check if note exists
    const existingNote = await db.accountingNote.findUnique({
      where: { id: normalizedId }
    })

    if (!existingNote) {
      return NextResponse.json({ error: "Accounting note not found" }, { status: 404 })
    }

    const body = await req.json()
    const { status, sourceType, pmAdvanceId } = body

    // Only Accountant and Admin can record accounting notes
    if (role !== "ACCOUNTANT" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (status === "CONVERTED") {
      const normalizedSourceType = sourceType ?? undefined

      if (
        normalizedSourceType &&
        normalizedSourceType !== "OFFICE_FUND" &&
        normalizedSourceType !== "PM_ADVANCE"
      ) {
        return NextResponse.json(
          { error: "Invalid source type. Use OFFICE_FUND or PM_ADVANCE" },
          { status: 400 }
        )
      }

      await convertAccountingNote({
        noteId: normalizedId,
        requestedSourceType: normalizedSourceType,
        requestedPmAdvanceId: pmAdvanceId ?? null,
        recordedByUserId: userId
      })
    } else if (status === "REJECTED") {
      const updateResult = await db.accountingNote.updateMany({
        where: {
          id: normalizedId,
          status: "PENDING"
        },
        data: {
          status: "REJECTED",
          convertedAt: new Date()
        }
      })

      if (!updateResult.count) {
        return NextResponse.json(
          { error: "Only pending notes can be rejected" },
          { status: 409 }
        )
      }
    } else {
      return NextResponse.json({ error: "Invalid status. Use CONVERTED or REJECTED" }, { status: 400 })
    }

    const refreshedNote = await db.accountingNote.findUnique({
      where: { id: normalizedId },
      include: {
        unit: {
          include: {
            project: true
          }
        },
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
      }
    })

    if (!refreshedNote) {
      return NextResponse.json({ error: "Accounting note not found" }, { status: 404 })
    }

    return NextResponse.json(refreshedNote)
  } catch (error) {
    if (error instanceof AccountingNoteNotFoundError) {
      return NextResponse.json({ error: "Accounting note not found" }, { status: 404 })
    }

    if (error instanceof AccountingNoteMissingUnitError) {
      return NextResponse.json(
        { error: "Accounting note is missing unit information" },
        { status: 400 }
      )
    }

    if (error instanceof AccountingNotePmAdvanceRequiredError) {
      return NextResponse.json(
        { error: "PM advance is required when using PM_ADVANCE" },
        { status: 400 }
      )
    }

    if (error instanceof AccountingNotePmAdvanceNotFoundError) {
      return NextResponse.json({ error: "PM Advance not found" }, { status: 404 })
    }

    if (error instanceof AccountingNotePmAdvanceInsufficientError) {
      return NextResponse.json(
        {
          error: "Insufficient PM Advance balance",
          remaining: error.remaining,
          needed: error.needed
        },
        { status: 400 }
      )
    }

    if (error instanceof AccountingNoteAlreadyProcessedError) {
      return NextResponse.json(
        { error: "Only pending notes can be converted" },
        { status: 409 }
      )
    }

    console.error("Error updating accounting note:", error)
    return NextResponse.json(
      { error: "Failed to update accounting note", details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE /api/accounting-notes/[id] - Delete accounting note (Admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role as string

    // Only Admin can delete accounting notes
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.accountingNote.delete({
      where: { id }
    })

    return NextResponse.json({ message: "Accounting note deleted successfully" })
  } catch (error) {
    console.error("Error deleting accounting note:", error)
    return NextResponse.json(
      { error: "Failed to delete accounting note" },
      { status: 500 }
    )
  }
}
