import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, isActive, monthlyBillingDay } = body

    const data: { name?: string; isActive?: boolean; monthlyBillingDay?: number | null } = {}
    if (typeof name === "string" && name.trim()) {
      data.name = name.trim()
    }
    if (typeof isActive === "boolean") {
      data.isActive = isActive
    }
    if (monthlyBillingDay !== undefined) {
      data.monthlyBillingDay =
        monthlyBillingDay === null || monthlyBillingDay === ""
          ? null
          : typeof monthlyBillingDay === "number"
            ? monthlyBillingDay
            : parseInt(String(monthlyBillingDay), 10)
      if (data.monthlyBillingDay !== null && (Number.isNaN(data.monthlyBillingDay) || data.monthlyBillingDay < 1 || data.monthlyBillingDay > 31)) {
        return NextResponse.json(
          { error: "monthlyBillingDay must be between 1 and 31" },
          { status: 400 }
        )
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Send at least one of: name, isActive, monthlyBillingDay" },
        { status: 400 }
      )
    }

    if (data.name) {
      const existing = await db.project.findFirst({
        where: { name: data.name, id: { not: id } }
      })
      if (existing) {
        return NextResponse.json(
          { error: "اسم مشروع آخر مستخدم مسبقاً" },
          { status: 400 }
        )
      }
    }

    const project = await db.project.update({
      where: { id },
      data
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const project = await db.project.findUnique({
      where: { id },
      include: { operationalUnits: { select: { id: true } } }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.operationalUnits.length > 0) {
      return NextResponse.json(
        {
          error: "لا يمكن حذف المشروع لأنه يحتوي على وحدات. احذف أو انقل الوحدات أولاً."
        },
        { status: 400 }
      )
    }

    await db.project.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: "تم حذف المشروع" })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    )
  }
}
