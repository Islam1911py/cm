"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import StaffAdvancesPage from "@/app/dashboard/admin/staff-advances/page"

export default function AccountantStaffAdvancesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === "loading") return null

  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
    router.replace("/login")
    return null
  }

  return <StaffAdvancesPage />
}
