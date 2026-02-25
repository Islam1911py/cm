import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const payrollId = params.id
    const body = await req.json()
    const { action } = body

    if (!action) {
      return NextResponse.json(
        { error: "Action is required (e.g., 'pay')" },
        { status: 400 }
      )
    }

    // @ts-ignore - النموذج موجود في Prisma
    const payroll = await db.payroll.findUnique({
      where: { id: payrollId },
      include: {
        payrollItems: true,
        deductedAdvances: true
      }
    })

    if (!payroll) {
      return NextResponse.json(
        { error: "Payroll not found" },
        { status: 404 }
      )
    }

    if (action === "pay") {
      // إذا كان الراتب في حالة PENDING، حول جميع السلفات المعلقة إلى DEDUCTED
      if (payroll.status === "PENDING") {
        // احصل على جميع السلفات المعلقة للموظفين في هذا الراتب
        const staffIds = payroll.payrollItems.map(item => item.staffId)
        
        // @ts-ignore - النموذج موجود في Prisma
        const pendingAdvances = await db.staffAdvance.findMany({
          where: {
            staffId: { in: staffIds },
            status: "PENDING"
          }
        })

        // تحديث جميع السلفات المعلقة إلى DEDUCTED
        for (const advance of pendingAdvances) {
          // @ts-ignore - النموذج موجود في Prisma
          await db.staffAdvance.update({
            where: { id: advance.id },
            data: {
              status: "DEDUCTED",
              deductedFromPayrollId: payrollId
            }
          })
        }

        // تحديث الراتب إلى PAID
        // @ts-ignore - النموذج موجود في Prisma
        const updatedPayroll = await db.payroll.update({
          where: { id: payrollId },
          data: {
            status: "PAID",
            paidAt: new Date()
          },
          include: {
            payrollItems: true,
            deductedAdvances: {
              include: {
                staff: { select: { name: true } }
              }
            }
          }
        })

        return NextResponse.json({
          success: true,
          message: "Payroll marked as paid and advances deducted",
          payroll: updatedPayroll
        })
      } else {
        return NextResponse.json(
          { error: "Payroll is already paid" },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[PAYROLL_PATCH]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
