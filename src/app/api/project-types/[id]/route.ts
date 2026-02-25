import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { Prisma } from "@prisma/client"

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { name } = body
    const urlId = req.nextUrl.pathname.split("/").pop()
    const projectTypeId = (params?.id ?? urlId ?? "").trim()

    if (!projectTypeId) {
      return NextResponse.json({ error: "Missing project type id" }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Check if new name already exists (excluding current)
    const existing = await db.projectType.findUnique({
      where: { name: name.trim() },
    })

    if (existing && existing.id !== projectTypeId) {
      return NextResponse.json(
        { error: "Project type name already exists" },
        { status: 409 }
      )
    }

    const projectType = await db.projectType.update({
      where: { id: projectTypeId },
      data: { name: name.trim() },
    })

    return NextResponse.json(projectType)
  } catch (error) {
    console.error("Error updating project type:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Project type not found" }, { status: 404 })
      }
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Project type name already exists" }, { status: 409 })
      }
    }
    return NextResponse.json(
      { error: "Failed to update project type" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const forceDelete = req.nextUrl.searchParams.get("force") === "true"

    // Check if any projects use this type
    const [elementsCount, projectsCount] = await Promise.all([
      db.projectElement.count({ where: { typeId: params.id } }),
      db.project.count({ where: { typeId: params.id } }),
    ])

    if (elementsCount > 0 || projectsCount > 0) {
      if (!forceDelete) {
        return NextResponse.json(
          {
            error: "لا يمكن حذف نوع المشروع لأنه مستخدم في مشاريع أو عناصر",
            elementsInUse: elementsCount,
            projectsInUse: projectsCount,
            retryWithForce: true
          },
          { status: 409 }
        )
      }

      const result = await db.$transaction(async (tx) => {
        let fallback = await tx.projectType.findFirst({
          where: { name: "غير مصنف" },
        })

        if (!fallback || fallback.id === params.id) {
          const fallbackName = fallback && fallback.id === params.id ? "غير مصنف بديل" : "غير مصنف"
          fallback = await tx.projectType.upsert({
            where: { name: fallbackName },
            update: {},
            create: { name: fallbackName },
          })
        }

        await tx.project.updateMany({
          where: { typeId: params.id },
          data: { typeId: fallback.id },
        })

        await tx.projectElement.updateMany({
          where: { typeId: params.id },
          data: { typeId: fallback.id },
        })

        await tx.projectType.delete({ where: { id: params.id } })

        return { reassignedTo: fallback }
      })

      return NextResponse.json({ success: true, ...result })
    }

    await db.projectType.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project type:", error)
    return NextResponse.json(
      { error: "Failed to delete project type", details: String(error) },
      { status: 500 }
    )
  }
}
