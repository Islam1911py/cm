import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"

export class AccountingNoteNotFoundError extends Error {
  constructor(public readonly noteId: string) {
    super("ACCOUNTING_NOTE_NOT_FOUND")
  }
}

export class AccountingNoteAlreadyProcessedError extends Error {
  constructor(public readonly noteId: string) {
    super("ACCOUNTING_NOTE_ALREADY_PROCESSED")
  }
}

export class AccountingNoteMissingUnitError extends Error {
  constructor(public readonly noteId: string) {
    super("ACCOUNTING_NOTE_MISSING_UNIT")
  }
}

export class AccountingNotePmAdvanceRequiredError extends Error {
  constructor(public readonly noteId: string) {
    super("ACCOUNTING_NOTE_PM_ADVANCE_REQUIRED")
  }
}

export class AccountingNotePmAdvanceNotFoundError extends Error {
  constructor(public readonly pmAdvanceId: string) {
    super("ACCOUNTING_NOTE_PM_ADVANCE_NOT_FOUND")
  }
}

export class AccountingNotePmAdvanceInsufficientError extends Error {
  constructor(public readonly remaining: number, public readonly needed: number) {
    super("ACCOUNTING_NOTE_PM_ADVANCE_INSUFFICIENT")
  }
}

const NOTE_INCLUDE = {
  unit: {
    include: {
      project: true
    }
  },
  project: true,
  pmAdvance: true,
  convertedToExpense: true
} satisfies Prisma.AccountingNoteInclude

export type AccountingNoteWithRelations = Prisma.AccountingNoteGetPayload<{
  include: typeof NOTE_INCLUDE
}>

export type ConvertAccountingNoteParams = {
  noteId: string
  requestedSourceType?: "OFFICE_FUND" | "PM_ADVANCE"
  requestedPmAdvanceId?: string | null
  recordedByUserId: string
}

export type ConvertAccountingNoteResult = {
  note: AccountingNoteWithRelations
  invoice: Prisma.InvoiceGetPayload<{}>
  expense: Prisma.OperationalExpenseGetPayload<{}>
  invoiceCreated: boolean
}

export async function convertAccountingNote({
  noteId,
  requestedSourceType,
  requestedPmAdvanceId,
  recordedByUserId
}: ConvertAccountingNoteParams): Promise<ConvertAccountingNoteResult> {
  const note = await db.accountingNote.findUnique({
    where: { id: noteId },
    include: NOTE_INCLUDE
  })

  if (!note) {
    throw new AccountingNoteNotFoundError(noteId)
  }

  if (!note.unit) {
    throw new AccountingNoteMissingUnitError(noteId)
  }

  if (note.status !== "PENDING") {
    throw new AccountingNoteAlreadyProcessedError(noteId)
  }

  const resolvedSourceType = requestedSourceType ?? (note.sourceType as "OFFICE_FUND" | "PM_ADVANCE" | null) ?? "OFFICE_FUND"
  const resolvedPmAdvanceId = resolvedSourceType === "PM_ADVANCE"
    ? requestedPmAdvanceId ?? note.pmAdvanceId ?? null
    : null

  if (resolvedSourceType === "PM_ADVANCE" && !resolvedPmAdvanceId) {
    throw new AccountingNotePmAdvanceRequiredError(noteId)
  }

  if (resolvedSourceType === "PM_ADVANCE" && resolvedPmAdvanceId) {
    const pmAdvance = await db.pMAdvance.findUnique({
      where: { id: resolvedPmAdvanceId },
      select: { remainingAmount: true }
    })

    if (!pmAdvance) {
      throw new AccountingNotePmAdvanceNotFoundError(resolvedPmAdvanceId)
    }

    if (pmAdvance.remainingAmount < note.amount) {
      throw new AccountingNotePmAdvanceInsufficientError(pmAdvance.remainingAmount, note.amount)
    }
  }

  const { invoice, expense, invoiceCreated } = await db.$transaction(async (tx) => {
    let invoiceCreatedFlag = false

    const openInvoices = await tx.invoice.findMany({
      where: {
        unitId: note.unitId,
        type: "CLAIM",
        remainingBalance: {
          gt: 0
        }
      },
      orderBy: {
        issuedAt: "asc"
      }
    })

    let invoiceRecord = openInvoices[0] ?? null

    if (invoiceRecord && openInvoices.length > 1) {
      const duplicates = openInvoices.slice(1)
      let amountIncrementFromDuplicates = 0
      let paidIncrementFromDuplicates = 0
      let balanceIncrementFromDuplicates = 0

      for (const duplicate of duplicates) {
        amountIncrementFromDuplicates += duplicate.amount
        paidIncrementFromDuplicates += duplicate.totalPaid
        balanceIncrementFromDuplicates += duplicate.remainingBalance

        await tx.operationalExpense.updateMany({
          where: { claimInvoiceId: duplicate.id },
          data: { claimInvoiceId: invoiceRecord.id }
        })

        await tx.unitExpense.updateMany({
          where: { claimInvoiceId: duplicate.id },
          data: { claimInvoiceId: invoiceRecord.id }
        })

        await tx.payment.updateMany({
          where: { invoiceId: duplicate.id },
          data: { invoiceId: invoiceRecord.id }
        })

        await tx.invoice.delete({ where: { id: duplicate.id } })
      }

      if (amountIncrementFromDuplicates !== 0 || paidIncrementFromDuplicates !== 0 || balanceIncrementFromDuplicates !== 0) {
        invoiceRecord = await tx.invoice.update({
          where: { id: invoiceRecord.id },
          data: {
            amount: {
              increment: amountIncrementFromDuplicates
            },
            totalPaid: {
              increment: paidIncrementFromDuplicates
            },
            remainingBalance: {
              increment: balanceIncrementFromDuplicates
            },
            isPaid: false
          }
        })
      }
    }

    if (invoiceRecord) {
      invoiceRecord = await tx.invoice.update({
        where: { id: invoiceRecord.id },
        data: {
          amount: {
            increment: note.amount
          },
          remainingBalance: {
            increment: note.amount
          },
          isPaid: false
        }
      })
    } else {
      let ownerAssociation = await tx.ownerAssociation.findFirst({
        where: { unitId: note.unitId }
      })

      if (!ownerAssociation) {
        ownerAssociation = await tx.ownerAssociation.create({
          data: {
            name: `Owner - ${note.unit.name}`,
            unitId: note.unitId,
            phone: "",
            email: ""
          }
        })
      }

      const invoiceNumber = `CLM-${Date.now()}-${note.unit.code}`
      invoiceRecord = await tx.invoice.create({
        data: {
          invoiceNumber,
          type: "CLAIM",
          unitId: note.unitId,
          ownerAssociationId: ownerAssociation.id,
          amount: note.amount,
          remainingBalance: note.amount
        }
      })
      invoiceCreatedFlag = true
    }

    const expenseRecord = await tx.operationalExpense.create({
      data: {
        description: note.description,
        amount: note.amount,
        sourceType: resolvedSourceType,
        unitId: note.unitId,
        claimInvoiceId: invoiceRecord.id,
        recordedByUserId,
        pmAdvanceId: resolvedSourceType === "PM_ADVANCE" ? resolvedPmAdvanceId : null,
        convertedFromNoteId: null
      }
    })

    if (resolvedSourceType === "PM_ADVANCE" && resolvedPmAdvanceId) {
      const deduction = await tx.pMAdvance.updateMany({
        where: {
          id: resolvedPmAdvanceId,
          remainingAmount: {
            gte: note.amount
          }
        },
        data: {
          remainingAmount: {
            decrement: note.amount
          }
        }
      })

      if (!deduction.count) {
        throw new AccountingNotePmAdvanceInsufficientError(0, note.amount)
      }
    }

    const noteUpdate = await tx.accountingNote.updateMany({
      where: {
        id: note.id,
        status: "PENDING"
      },
      data: {
        status: "CONVERTED",
        convertedAt: new Date(),
        convertedToExpenseId: expenseRecord.id,
        pmAdvanceId: resolvedSourceType === "PM_ADVANCE" ? resolvedPmAdvanceId : null,
        sourceType: resolvedSourceType
      }
    })

    if (!noteUpdate.count) {
      throw new AccountingNoteAlreadyProcessedError(note.id)
    }

    await tx.operationalExpense.update({
      where: { id: expenseRecord.id },
      data: {
        convertedFromNoteId: expenseRecord.id
      }
    })

    return {
      invoice: invoiceRecord,
      expense: expenseRecord,
      invoiceCreated: invoiceCreatedFlag
    }
  })

  const refreshedNote = await db.accountingNote.findUnique({
    where: { id: noteId },
    include: NOTE_INCLUDE
  })

  if (!refreshedNote) {
    throw new AccountingNoteNotFoundError(noteId)
  }

  return {
    note: refreshedNote,
    invoice,
    expense,
    invoiceCreated
  }
}
