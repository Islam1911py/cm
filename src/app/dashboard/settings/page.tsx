"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface CurrentUserResponse {
  id: string
  name: string
  email: string
  role: string
  whatsappPhone: string | null
  canViewAllProjects: boolean
}

export default function SettingsPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [profile, setProfile] = useState<CurrentUserResponse | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [profileError, setProfileError] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
      return
    }

    if (status !== "authenticated") {
      return
    }

    const loadProfile = async () => {
      try {
        setLoadingProfile(true)
        setProfileError(null)
        const response = await fetch("/api/users/me", { cache: "no-store" })
        if (response.status === 401) {
          router.replace("/login")
          return
        }

        if (!response.ok) {
          const body = await response.json().catch(() => null)
          const message = body?.error || "تعذر تحميل البيانات"
          throw new Error(message)
        }

        const data = (await response.json()) as CurrentUserResponse
        setProfile(data)
        setName(data.name)
        setEmail(data.email)
      } catch (error) {
        console.error("Error loading profile:", error)
        setProfileError(error instanceof Error ? error.message : "تعذر تحميل البيانات")
        toast({
          title: "خطأ",
          description: error instanceof Error ? error.message : "يرجى المحاولة مرة أخرى",
          variant: "destructive"
        })
      } finally {
        setLoadingProfile(false)
      }
    }

    void loadProfile()
  }, [status, router, toast])

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setProfileError("يرجى إدخال اسم صالح")
      return
    }

    if (trimmedName === profile.name) {
      setProfileError("لا توجد تغييرات لحفظها")
      return
    }

    try {
      setSavingProfile(true)
      setProfileError(null)

      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName })
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message = body?.error || "تعذر حفظ التغييرات"
        setProfileError(message)
        return
      }

      const updated = body as CurrentUserResponse
      setProfile(updated)
      setName(updated.name)

      if (typeof update === "function") {
        try {
          await update({ name: updated.name })
        } catch (sessionError) {
          console.warn("Failed to refresh session after profile update", sessionError)
        }
      }

      toast({
        title: "تم الحفظ",
        description: "تم تحديث الاسم بنجاح"
      })
    } catch (error) {
      console.error("Error updating profile:", error)
      setProfileError("حدث خطأ أثناء حفظ البيانات")
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profile) return

    const trimmedCurrent = currentPassword.trim()
    const trimmedNew = newPassword.trim()
    const trimmedConfirm = confirmPassword.trim()

    if (!trimmedCurrent || !trimmedNew || !trimmedConfirm) {
      setPasswordError("يرجى تعبئة جميع الحقول")
      return
    }

    if (trimmedNew.length < 8) {
      setPasswordError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل")
      return
    }

    if (trimmedNew !== trimmedConfirm) {
      setPasswordError("كلمتا المرور غير متطابقتين")
      return
    }

    try {
      setSavingPassword(true)
      setPasswordError(null)

      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: trimmedCurrent, newPassword: trimmedNew })
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message = body?.error || "تعذر تحديث كلمة المرور"
        setPasswordError(message)
        return
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      toast({
        title: "تم التحديث",
        description: "تم تغيير كلمة المرور"
      })
    } catch (error) {
      console.error("Error updating password:", error)
      setPasswordError("حدث خطأ أثناء تحديث كلمة المرور")
    } finally {
      setSavingPassword(false)
    }
  }

  const showLoadingState = status === "loading" || loadingProfile

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">حدث بيانات حسابك وكلمة المرور من هنا.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>البيانات الشخصية</CardTitle>
            <CardDescription>قم بتعديل اسم العرض المرتبط بحسابك.</CardDescription>
          </CardHeader>
          <CardContent>
            {showLoadingState && !profile ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {profileError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {profileError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="settings-email">البريد الإلكتروني</Label>
                  <Input id="settings-email" value={email} disabled readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-name">الاسم الكامل</Label>
                  <Input
                    id="settings-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="اسمك الكامل"
                  />
                </div>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  حفظ الاسم
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تغيير كلمة المرور</CardTitle>
            <CardDescription>استخدم كلمة مرور قوية ولا تشاركها مع أي شخص.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {passwordError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="settings-current-password">كلمة المرور الحالية</Label>
                <div className="relative">
                  <Input
                    id="settings-current-password"
                    type={showPasswords.current ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="********"
                    autoComplete="current-password"
                    className="pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 left-2 h-auto px-2 text-muted-foreground"
                    onClick={() =>
                      setShowPasswords((state) => ({
                        ...state,
                        current: !state.current
                      }))
                    }
                    aria-label={showPasswords.current ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-new-password">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="settings-new-password"
                    type={showPasswords.next ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="********"
                    autoComplete="new-password"
                    className="pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 left-2 h-auto px-2 text-muted-foreground"
                    onClick={() =>
                      setShowPasswords((state) => ({
                        ...state,
                        next: !state.next
                      }))
                    }
                    aria-label={showPasswords.next ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPasswords.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-confirm-password">تأكيد كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="settings-confirm-password"
                    type={showPasswords.confirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="********"
                    autoComplete="new-password"
                    className="pl-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute inset-y-0 left-2 h-auto px-2 text-muted-foreground"
                    onClick={() =>
                      setShowPasswords((state) => ({
                        ...state,
                        confirm: !state.confirm
                      }))
                    }
                    aria-label={showPasswords.confirm ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  >
                    {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                حفظ كلمة المرور
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
