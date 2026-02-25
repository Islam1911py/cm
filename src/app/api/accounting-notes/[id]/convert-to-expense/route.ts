import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"
import {
  convertAccountingNote,
  AccountingNoteAlreadyProcessedError,
  AccountingNoteNotFoundError,
  AccountingNotePmAdvanceInsufficientError,
  AccountingNotePmAdvanceNotFoundError,
  AccountingNotePmAdvanceRequiredError,
  AccountingNoteMissingUnitError
} from "@/lib/accounting-note-conversion"

// POST /api/accounting-notes/[id]/convert-to-expense
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only Accountant and Admin can convert
    if (session.user.role !== "ACCOUNTANT" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = params
    const body = await req.json()
    const { pmAdvanceId } = body

    try {
      const { note, expense, invoice, invoiceCreated } = await convertAccountingNote({
        noteId: id,
        requestedPmAdvanceId: pmAdvanceId ?? null,
        recordedByUserId: session.user.id
      })

      return NextResponse.json({
        note,
        expense,
        invoice,
        invoiceAction: invoiceCreated ? "CREATED" : "UPDATED"
      })
    } catch (error: unknown) {
      if (error instanceof AccountingNoteNotFoundError) {
        return NextResponse.json(
          { error: "Accounting note not found" },
          { status: 404 }
        )
      }

      if (error instanceof AccountingNoteMissingUnitError) {
        return NextResponse.json(
          { error: "Accounting note is missing unit information" },
          { status: 400 }
        )
      }

      if (error instanceof AccountingNotePmAdvanceRequiredError) {
        return NextResponse.json(
          { error: "PM Advance ID is required for PM advance notes" },
          { status: 400 }
        )
      }

      if (error instanceof AccountingNotePmAdvanceNotFoundError) {
        return NextResponse.json(
          { error: "PM Advance not found" },
          { status: 404 }
        )
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
        const existing = await prisma.accountingNote.findUnique({
          where: { id },
          include: {
            convertedToExpense: true
          }
        })

        return NextResponse.json(
          {
            error: "Only pending notes can be converted",
            note: existing
          },
          { status: 409 }
        )
      }

      throw error
    }
  } catch (error) {
    console.error("Error converting note to expense:", error)
    return NextResponse.json(
      { error: "Failed to convert note to expense" },
      { status: 500 }
    )
  }
}
