import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { projectId, name, typeId } = body

    if (!projectId || !name?.trim() || !typeId) {
      return NextResponse.json(
        { error: "Project ID, name, and type ID are required" },
        { status: 400 }
      )
    }

    // Check if project exists
    const project = await db.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    // Check if type exists
    const type = await db.projectType.findUnique({
      where: { id: typeId },
    })

    if (!type) {
      return NextResponse.json(
        { error: "Project type not found" },
        { status: 404 }
      )
    }

    // Check if element with same name already exists for this project
    const existing = await db.projectElement.findFirst({
      where: {
        projectId,
        name: name.trim(),
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Element with this name already exists in this project" },
        { status: 409 }
      )
    }

    const element = await db.projectElement.create({
      data: {
        projectId,
        name: name.trim(),
        typeId,
      },
      include: {
        type: true,
      },
    })

    return NextResponse.json(element, { status: 201 })
  } catch (error) {
    console.error("Error creating project element:", error)
    return NextResponse.json(
      { error: "Failed to create project element" },
      { status: 500 }
    )
  }
}
