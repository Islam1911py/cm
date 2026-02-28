import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const existing = await db.unitType.findUnique({
      where: { name: name.trim() },
    })
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { error: "Unit type name already exists" },
        { status: 409 }
      )
    }

    const unitType = await db.unitType.update({
      where: { id },
      data: { name: name.trim() },
    })

    return NextResponse.json(unitType)
  } catch (error) {
    console.error("Error updating unit type:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Unit type not found" }, { status: 404 })
      }
    }
    return NextResponse.json(
      { error: "Failed to update unit type" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const unitsCount = await db.operationalUnit.count({ where: { typeId: id } })

    if (unitsCount > 0) {
      return NextResponse.json(
        {
          error: "لا يمكن حذف نوع الوحدة لأنه مستخدم في وحدات",
          unitsInUse: unitsCount,
        },
        { status: 409 }
      )
    }

    await db.unitType.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting unit type:", error)
    return NextResponse.json(
      { error: "Failed to delete unit type" },
      { status: 500 }
    )
  }
}
