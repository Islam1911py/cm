"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AlertCircle, ShieldCheck } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

interface PMUser {
  id: string
  name: string
  email: string
  role: string
  canViewAllProjects: boolean
}

export default function PMPermissionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [users, setUsers] = useState<PMUser[]>([])
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "loading") return
    if (!session || !isAdmin) {
      router.replace("/dashboard")
      return
    }

    fetchUsers()
  }, [session, status, isAdmin, router])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/users?role=PROJECT_MANAGER")
      if (!res.ok) {
        throw new Error("Failed to fetch project managers")
      }
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Error fetching project managers:", err)
      setError("تعذر تحميل مديري المشاريع")
    } finally {
      setLoading(false)
    }
  }

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name, "ar"))
  }, [users])

  const togglePermission = async (userId: string, value: boolean) => {
    const previousUsers = users
    setUsers((current) =>
      current.map((user) =>
        user.id === userId ? { ...user, canViewAllProjects: value } : user
      )
    )
    setSavingIds((current) => [...current, userId])

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canViewAllProjects: value })
      })

      if (!res.ok) {
        throw new Error("Failed to update permissions")
      }

      toast({
        title: "تم تحديث الصلاحية",
        description: value
          ? "تم منح صلاحية عرض جميع المشاريع"
          : "تم تقييد العرض بالمشاريع المسنودة فقط"
      })
    } catch (err) {
      console.error("Error updating permissions:", err)
      setUsers(previousUsers)
      toast({
        title: "تعذر تحديث الصلاحية",
        description: "حاول مرة أخرى",
        variant: "destructive"
      })
    } finally {
      setSavingIds((current) => current.filter((id) => id !== userId))
    }
  }

  return (
    <div className="flex-1 p-8 lg:p-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              صلاحيات مديري المشاريع
            </CardTitle>
            <CardDescription>
              تحكم في إمكانية مشاهدة جميع المشاريع لكل مدير مشروع.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedUsers.length === 0 ? (
                  <p className="text-sm text-gray-500">لا يوجد مديرو مشاريع حاليا.</p>
                ) : (
                  sortedUsers.map((user) => (
                    <div key={user.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-gray-500">
                          عرض كل المشاريع
                        </div>
                        <Switch
                          checked={user.canViewAllProjects}
                          disabled={savingIds.includes(user.id)}
                          onCheckedChange={(value) => togglePermission(user.id, value)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
