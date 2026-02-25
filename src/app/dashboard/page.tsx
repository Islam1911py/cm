"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") {
      const role = session.user.role as string
      
      // Redirect based on role
      if (role === "ACCOUNTANT") {
        router.replace("/dashboard/accountant")
      } else if (role === "PROJECT_MANAGER") {
        router.replace("/dashboard/manager")
      } else if (role === "ADMIN") {
        router.replace("/dashboard/admin")
      }
    }
  }, [session, status, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    </div>
  )
}
