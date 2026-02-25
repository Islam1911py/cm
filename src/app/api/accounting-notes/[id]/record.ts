import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db as prisma } from "@/lib/db"
import {
  convertAccountingNote,
  AccountingNoteAlreadyProcessedError,
  AccountingNoteMissingUnitError,
  AccountingNoteNotFoundError,
  AccountingNotePmAdvanceInsufficientError,
  AccountingNotePmAdvanceNotFoundError,
  AccountingNotePmAdvanceRequiredError
} from "@/lib/accounting-note-conversion"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const noteId = params.id

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
    const { sourceType, pmAdvanceId } = body

    const normalizedSourceType = sourceType ?? undefined

    if (
      normalizedSourceType &&
      normalizedSourceType !== "OFFICE_FUND" &&
      normalizedSourceType !== "PM_ADVANCE"
    ) {
      return NextResponse.json({ error: "Invalid source type" }, { status: 400 })
    }

    const { invoice, expense, invoiceCreated } = await convertAccountingNote({
      noteId,
      requestedSourceType: normalizedSourceType,
      requestedPmAdvanceId: pmAdvanceId ?? null,
      recordedByUserId: session.user.id
    })

    const message = invoiceCreated
      ? "Accounting note recorded successfully. Invoice created."
      : "Accounting note recorded successfully. Existing invoice updated."

    return NextResponse.json({
      success: true,
      message,
      invoice,
      expense,
      invoiceNumber: invoice.invoiceNumber
    })
  } catch (error) {
    console.error("Error recording accounting note:", error)

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
      return NextResponse.json({ error: "PM Advance ID is required" }, { status: 400 })
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
      const existing = await prisma.accountingNote.findUnique({
        where: { id: noteId },
        include: {
          convertedToExpense: true
        }
      })

      return NextResponse.json(
        {
          error: "This note has already been recorded",
          note: existing
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: "Failed to record accounting note", details: String(error) },
      { status: 500 }
    )
  }
}
