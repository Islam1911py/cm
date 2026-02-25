import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // @ts-ignore - النموذج موجود في Prisma
    const payrolls = await db.payroll.findMany({
      include: {
        payrollItems: true,
        createdByUser: {
          select: { name: true }
        }
      },
      orderBy: {
        month: "desc"
      }
    })

    // Get all pending advances for each staff
    // @ts-ignore
    const allAdvances = await db.staffAdvance.findMany({
      where: {
        status: "PENDING"
      }
    })

    // Create a map of staffId -> total pending advances
    const advancesMap = new Map<string, number>()
    allAdvances.forEach((adv: any) => {
      const current = advancesMap.get(adv.staffId) || 0
      advancesMap.set(adv.staffId, current + adv.amount)
    })

    const formattedPayrolls = payrolls.map((payroll: any) => {
      // Recalculate with current pending advances
      let newTotalAdvances = 0
      const updatedItems = payroll.payrollItems.map((item: any) => {
        const currentAdvances = advancesMap.get(item.staffId) || 0
        const newNet = item.salary - currentAdvances
        newTotalAdvances += currentAdvances
        return {
          id: item.id,
          staffId: item.staffId,
          name: item.name,
          salary: item.salary,
          advances: currentAdvances,
          net: newNet
        }
      })

      const newTotalNet = payroll.totalGross - newTotalAdvances

      return {
        ...payroll,
        totalAdvances: newTotalAdvances,
        totalNet: newTotalNet,
        payrollItems: updatedItems
      }
    })

    return NextResponse.json(formattedPayrolls)
  } catch (error) {
    console.error("[PAYROLL_GET]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { month } = await req.json()

    if (!month) {
      return NextResponse.json(
        { error: "Month is required" },
        { status: 400 }
      )
    }

    // @ts-ignore - النموذج موجود في Prisma
    const existing = await db.payroll.findFirst({
      where: { month }
    })

    if (existing) {
      return NextResponse.json(
        { error: "Payroll already exists for this month" },
        { status: 400 }
      )
    }

    // Get all staff members
    const staffMembers = await db.staff.findMany({
      include: {
        // @ts-ignore - العلاقة موجودة
        advances: {
          where: {
            status: "PENDING"
          }
        }
      }
    })

    if (staffMembers.length === 0) {
      return NextResponse.json(
        { error: "No staff members found" },
        { status: 400 }
      )
    }

    let totalGross = 0
    let totalAdvances = 0

    // Calculate payroll items
    const payrollItems = staffMembers.map((staff: any) => {
      const salary = staff.salary || 0
      // @ts-ignore
      const advances = staff.advances.reduce((sum: number, adv: any) => sum + adv.amount, 0)
      const net = salary - advances

      totalGross += salary
      totalAdvances += advances

      return {
        staffId: staff.id,
        name: staff.name,
        salary,
        advances,
        net
      }
    })

    const totalNet = totalGross - totalAdvances

    // @ts-ignore - النموذج موجود في Prisma
    const payroll = await db.payroll.create({
      data: {
        month,
        totalGross,
        totalAdvances,
        totalNet,
        status: "PENDING",
        createdByUserId: session.user.id,
        payrollItems: {
          create: payrollItems
        }
      },
      include: {
        payrollItems: true
      }
    })

    return NextResponse.json(payroll, { status: 201 })
  } catch (error) {
    console.error("[PAYROLL_POST]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
