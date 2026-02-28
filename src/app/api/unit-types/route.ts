import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const unitTypes = await db.unitType.findMany({
      orderBy: { name: "asc" },
    })

    return NextResponse.json(unitTypes)
  } catch (error) {
    console.error("Error fetching unit types:", error)
    return NextResponse.json(
      { error: "Failed to fetch unit types" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const existing = await db.unitType.findUnique({
      where: { name: name.trim() },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Unit type already exists" },
        { status: 409 }
      )
    }

    const unitType = await db.unitType.create({
      data: { name: name.trim() },
    })

    return NextResponse.json(unitType, { status: 201 })
  } catch (error) {
    console.error("Error creating unit type:", error)
    return NextResponse.json(
      { error: "Failed to create unit type" },
      { status: 500 }
    )
  }
}
