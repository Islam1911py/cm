import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Check if element exists
    const element = await db.projectElement.findUnique({
      where: { id },
    })

    if (!element) {
      return NextResponse.json(
        { error: "Project element not found" },
        { status: 404 }
      )
    }

    // Delete the element
    await db.projectElement.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project element:", error)
    return NextResponse.json(
      { error: "Failed to delete project element" },
      { status: 500 }
    )
  }
}
