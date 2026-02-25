import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const projectTypes = await db.projectType.findMany({
      orderBy: { name: "asc" },
    })

    return NextResponse.json(projectTypes)
  } catch (error) {
    console.error("Error fetching project types:", error)
    return NextResponse.json(
      { error: "Failed to fetch project types" },
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

    // Check if already exists
    const existing = await db.projectType.findUnique({
      where: { name: name.trim() },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Project type already exists" },
        { status: 409 }
      )
    }

    const projectType = await db.projectType.create({
      data: {
        name: name.trim(),
      },
    })

    return NextResponse.json(projectType, { status: 201 })
  } catch (error) {
    console.error("Error creating project type:", error)
    return NextResponse.json(
      { error: "Failed to create project type" },
      { status: 500 }
    )
  }
}
