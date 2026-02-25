"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import PayrollPage from "@/app/dashboard/admin/payroll/page"

export default function AccountantPayrollPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (status === "loading") return null

  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT")) {
    router.replace("/login")
    return null
  }

  return <PayrollPage />
}
