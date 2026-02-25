"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Calculator, Eye, EyeOff, Loader2, Phone, ShieldCheck, Users } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

type ManagedRole = "ADMIN" | "ACCOUNTANT" | "PROJECT_MANAGER"

// The page manages three categories that interact with WhatsApp automations.
const MANAGED_ROLES: ManagedRole[] = ["ADMIN", "ACCOUNTANT", "PROJECT_MANAGER"]

const isManagedRole = (role: string): role is ManagedRole =>
  MANAGED_ROLES.includes(role as ManagedRole)

const ROLE_SECTIONS: Record<ManagedRole, { title: string; description: string }> = {
  ADMIN: {
    title: "أرقام الإدارة",
    description: "هذه الأرقام مخولة بطلب أي بيانات أو تعديل صلاحيات المستخدمين عبر التكامل."
  },
  ACCOUNTANT: {
    title: "أرقام المحاسبين",
    description: "تسمح بإرسال أوامر الاستعلام عن الفواتير، الدفعات، والملاحظات المحاسبية."
  },
  PROJECT_MANAGER: {
    title: "أرقام مديري المشاريع",
    description: "تُستخدم لإرسال المصروفات التشغيلية والملاحظات الخاصة بمشاريع محددة."
  }
}

const COUNTRY_CODE_OPTIONS = [
  { value: "+20", label: "+20 مصر" },
  { value: "+971", label: "+971 الإمارات" },
  { value: "+966", label: "+966 السعودية" },
  { value: "+974", label: "+974 قطر" },
  { value: "+965", label: "+965 الكويت" },
  { value: "custom", label: "رمز آخر" }
]

interface ProjectAssignment {
  projectId: string
  project: {
    id: string
    name: string
  }
}

interface ContactUser {
  id: string
  name: string
  email: string
  role: ManagedRole | string
  canViewAllProjects: boolean
  whatsappPhone: string | null
  assignedProjects: ProjectAssignment[]
}

interface Project {
  id: string
  name: string
}

export default function PMContactsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [contactGroups, setContactGroups] = useState<Record<ManagedRole, ContactUser[]>>({
    ADMIN: [],
    ACCOUNTANT: [],
    PROJECT_MANAGER: []
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingPhoneId, setSavingPhoneId] = useState<string | null>(null)
  const [projectDialogContact, setProjectDialogContact] = useState<ContactUser | null>(null)
  const [projectSelection, setProjectSelection] = useState<string[]>([])
  const [savingProjects, setSavingProjects] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    role: "PROJECT_MANAGER" as ManagedRole,
    countryCode: "+20",
    phoneNumber: "",
    canViewAllProjects: false
  })
  const [createProjectSelection, setCreateProjectSelection] = useState<string[]>([])
  const [useCustomCountryCode, setUseCustomCountryCode] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editDialogContact, setEditDialogContact] = useState<ContactUser | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    role: "PROJECT_MANAGER" as ManagedRole,
    canViewAllProjects: false,
    newPassword: "",
    confirmPassword: ""
  })
  const [editError, setEditError] = useState<string | null>(null)
  const [savingDetails, setSavingDetails] = useState(false)
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null)
  const [editPasswordVisibility, setEditPasswordVisibility] = useState({
    next: false,
    confirm: false
  })

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "loading") return

    if (!session || !isAdmin) {
      router.replace("/dashboard")
      return
    }

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [roleResponses, projectsRes] = await Promise.all([
          Promise.all(
            MANAGED_ROLES.map((role) =>
              fetch(`/api/users?role=${role}`, { cache: "no-store" })
            )
          ),
          fetch("/api/projects", { cache: "no-store" })
        ])

        const failedRole = roleResponses.find((response) => !response.ok)
        if (failedRole) {
          throw new Error("تعذر تحميل بيانات المستخدمين")
        }

        if (!projectsRes.ok) {
          throw new Error("تعذر تحميل قائمة المشاريع")
        }

        const roleData = await Promise.all(roleResponses.map((response) => response.json()))
        const projectsData: Project[] = await projectsRes.json()

        const groups: Record<ManagedRole, ContactUser[]> = {
          ADMIN: [],
          ACCOUNTANT: [],
          PROJECT_MANAGER: []
        }

        MANAGED_ROLES.forEach((role, index) => {
          const data = roleData[index]
          groups[role] = Array.isArray(data) ? data : []
        })

        setContactGroups(groups)
        setProjects(Array.isArray(projectsData) ? projectsData : [])

        const initialDrafts: Record<string, string> = {}
        MANAGED_ROLES.forEach((role) => {
          groups[role].forEach((user) => {
            initialDrafts[user.id] = user.whatsappPhone ?? ""
          })
        })
        setPhoneDrafts(initialDrafts)
      } catch (err) {
        console.error("Error loading contact data:", err)
        setError(err instanceof Error ? err.message : "تعذر تحميل البيانات")
        toast({
          title: "خطأ",
          description: err instanceof Error ? err.message : "يرجى المحاولة مرة أخرى",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    void fetchData()
  }, [session, status, isAdmin, router, toast])

  const openProjectDialog = (contact: ContactUser) => {
    setProjectDialogContact(contact)
    setProjectSelection(contact.assignedProjects?.map((assignment) => assignment.projectId) ?? [])
  }

  const closeProjectDialog = () => {
    setProjectDialogContact(null)
    setProjectSelection([])
  }

  const toggleProjectSelection = (projectId: string, checked: boolean) => {
    setProjectSelection((current) => {
      if (checked) {
        return Array.from(new Set([...current, projectId]))
      }
      return current.filter((id) => id !== projectId)
    })
  }

  const resetCreateState = () => {
    setCreateForm({
      name: "",
      email: "",
      role: "PROJECT_MANAGER" as ManagedRole,
      countryCode: "+20",
      phoneNumber: "",
      canViewAllProjects: false
    })
    setCreateProjectSelection([])
    setUseCustomCountryCode(false)
    setCreateError(null)
  }

  const resetEditState = () => {
    setEditForm({
      name: "",
      role: "PROJECT_MANAGER",
      canViewAllProjects: false,
      newPassword: "",
      confirmPassword: ""
    })
    setEditError(null)
    setEditPasswordVisibility({ next: false, confirm: false })
  }

  const handleCreateProjectToggle = (projectId: string, checked: boolean) => {
    setCreateProjectSelection((current) => {
      if (checked) {
        return Array.from(new Set([...current, projectId]))
      }
      return current.filter((id) => id !== projectId)
    })
  }

  const handleCreateRoleChange = (role: ManagedRole) => {
    setCreateForm((current) => ({
      ...current,
      role,
      canViewAllProjects: role === "PROJECT_MANAGER" ? current.canViewAllProjects : false
    }))
    if (role !== "PROJECT_MANAGER") {
      setCreateProjectSelection([])
    }
  }

  const handleCreateDialogChange = (open: boolean) => {
    setCreateDialogOpen(open)
    if (!open) {
      resetCreateState()
    }
  }

  const handleCountryCodeChange = (value: string) => {
    if (value === "custom") {
      setUseCustomCountryCode(true)
      setCreateForm((current) => ({
        ...current,
        countryCode: ""
      }))
    } else {
      setUseCustomCountryCode(false)
      setCreateForm((current) => ({
        ...current,
        countryCode: value
      }))
    }
  }

  const handleCreateUser = async () => {
    const trimmedName = createForm.name.trim()
    const trimmedEmail = createForm.email.trim()
    const trimmedPhone = createForm.phoneNumber.replace(/\s+/g, "")
    const selectedCode = (createForm.countryCode || "").trim() || "+20"

    if (!trimmedName) {
      setCreateError("الاسم مطلوب")
      return
    }

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setCreateError("يرجى إدخال بريد إلكتروني صالح")
      return
    }

    if (useCustomCountryCode && !createForm.countryCode.trim()) {
      setCreateError("يرجى إدخال رمز دولة صالح")
      return
    }

    if (!trimmedPhone) {
      setCreateError("يرجى إدخال رقم واتساب")
      return
    }

    if (
      createForm.role === "PROJECT_MANAGER" &&
      !createForm.canViewAllProjects &&
      createProjectSelection.length === 0
    ) {
      setCreateError("يجب اختيار مشروع واحد على الأقل أو السماح بجميع المشاريع")
      return
    }

    setCreateError(null)

    const payload = {
      name: trimmedName,
      email: trimmedEmail,
      role: createForm.role,
      countryCode: selectedCode.startsWith("+") ? selectedCode : `+${selectedCode}`,
      phoneNumber: trimmedPhone,
      canViewAllProjects:
        createForm.role === "PROJECT_MANAGER" ? Boolean(createForm.canViewAllProjects) : false,
      projectIds:
        createForm.role === "PROJECT_MANAGER" && !createForm.canViewAllProjects
          ? createProjectSelection
          : []
    }

    try {
      setCreatingUser(true)
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const errorMessage = body?.error || "تعذر إنشاء المستخدم"
        setCreateError(errorMessage)
        return
      }

      const { user, temporaryPassword } = body as {
        user: ContactUser
        temporaryPassword: string
      }

      if (!user || !temporaryPassword) {
        setCreateError("استجابة غير متوقعة من الخادم")
        return
      }

      const roleKey = MANAGED_ROLES.includes(user.role as ManagedRole)
        ? (user.role as ManagedRole)
        : null

      if (roleKey) {
        setContactGroups((current) => ({
          ...current,
          [roleKey]: [...current[roleKey], user].sort((a, b) => a.name.localeCompare(b.name, "ar"))
        }))
      }

      setPhoneDrafts((current) => ({
        ...current,
        [user.id]: user.whatsappPhone ?? ""
      }))

      toast({
        title: "تم إنشاء المستخدم",
        description: `كلمة المرور المؤقتة: ${temporaryPassword}`,
        duration: 12000
      })

      handleCreateDialogChange(false)
    } catch (err) {
      console.error("Error creating user:", err)
      setCreateError("حدث خطأ أثناء إنشاء المستخدم")
    } finally {
      setCreatingUser(false)
    }
  }

  const openEditDialog = (contact: ContactUser) => {
    const role = isManagedRole(contact.role) ? (contact.role as ManagedRole) : "PROJECT_MANAGER"

    setEditDialogContact(contact)
    setEditForm({
      name: contact.name,
      role,
      canViewAllProjects: role === "PROJECT_MANAGER" ? contact.canViewAllProjects : false,
      newPassword: "",
      confirmPassword: ""
    })
    setEditError(null)
    setEditPasswordVisibility({ next: false, confirm: false })
  }

  const closeEditDialog = () => {
    setEditDialogContact(null)
    resetEditState()
  }

  const handleSaveDetails = async () => {
    if (!editDialogContact) return

    const trimmedName = editForm.name.trim()
    if (!trimmedName) {
      setEditError("يرجى إدخال اسم صالح")
      return
    }

    const currentRole = isManagedRole(editDialogContact.role)
      ? (editDialogContact.role as ManagedRole)
      : "PROJECT_MANAGER"
    const selectedRole = editForm.role
    const roleChanged = selectedRole !== currentRole

    const updates: Record<string, unknown> = {}

    if (trimmedName !== editDialogContact.name) {
      updates.name = trimmedName
    }

    const trimmedNewPassword = editForm.newPassword.trim()
    const trimmedConfirmPassword = editForm.confirmPassword.trim()

    if (trimmedNewPassword || trimmedConfirmPassword) {
      if (trimmedNewPassword.length < 8) {
        setEditError("كلمة المرور يجب أن تكون 8 أحرف على الأقل")
        return
      }

      if (trimmedNewPassword !== trimmedConfirmPassword) {
        setEditError("كلمتا المرور غير متطابقتين")
        return
      }

      updates.password = trimmedNewPassword
    }

    if (roleChanged) {
      updates.role = selectedRole
    }

    if (selectedRole === "PROJECT_MANAGER") {
      const canViewAll = Boolean(editForm.canViewAllProjects)
      if (roleChanged || editDialogContact.canViewAllProjects !== canViewAll) {
        updates.canViewAllProjects = canViewAll
      }
    } else if (editDialogContact.canViewAllProjects) {
      updates.canViewAllProjects = false
    }

    if (Object.keys(updates).length === 0) {
      setEditError("لا توجد تغييرات لحفظها")
      return
    }

    try {
      setSavingDetails(true)
      const response = await fetch(`/api/users/${editDialogContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        const message = body?.error || "تعذر حفظ التغييرات"
        setEditError(message)
        return
      }

      const updatedContact = body as ContactUser

      setContactGroups((current) => {
        const nextGroups: Record<ManagedRole, ContactUser[]> = {
          ADMIN: current.ADMIN.filter((user) => user.id !== editDialogContact.id),
          ACCOUNTANT: current.ACCOUNTANT.filter((user) => user.id !== editDialogContact.id),
          PROJECT_MANAGER: current.PROJECT_MANAGER.filter((user) => user.id !== editDialogContact.id)
        }

        if (isManagedRole(updatedContact.role)) {
          const roleKey = updatedContact.role as ManagedRole
          nextGroups[roleKey] = [...nextGroups[roleKey], updatedContact].sort((a, b) =>
            a.name.localeCompare(b.name, "ar")
          )
        }

        return nextGroups
      })

      setPhoneDrafts((current) => ({
        ...current,
        [updatedContact.id]: updatedContact.whatsappPhone ?? ""
      }))

      toast({
        title: "تم الحفظ",
        description: "تم تحديث بيانات المستخدم"
      })

      closeEditDialog()
    } catch (err) {
      console.error("Error updating user details:", err)
      setEditError("حدث خطأ أثناء حفظ البيانات")
    } finally {
      setSavingDetails(false)
    }
  }

  const handleDeleteContact = async (contact: ContactUser) => {
    const confirmDelete = window.confirm("سيتم حذف هذا المستخدم نهائيًا. هل أنت متأكد؟")
    if (!confirmDelete) {
      return
    }

    try {
      setDeletingContactId(contact.id)
      const response = await fetch(`/api/users/${contact.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message = body?.error || "تعذر حذف المستخدم"
        throw new Error(message)
      }

      setContactGroups((current) => ({
        ADMIN: current.ADMIN.filter((user) => user.id !== contact.id),
        ACCOUNTANT: current.ACCOUNTANT.filter((user) => user.id !== contact.id),
        PROJECT_MANAGER: current.PROJECT_MANAGER.filter((user) => user.id !== contact.id)
      }))

      setPhoneDrafts((current) => {
        const next = { ...current }
        delete next[contact.id]
        return next
      })

      toast({
        title: "تم الحذف",
        description: "تم إزالة المستخدم من القائمة"
      })

      closeEditDialog()
    } catch (err) {
      console.error("Error deleting user:", err)
      toast({
        title: "خطأ",
        description: err instanceof Error ? err.message : "تعذر حذف المستخدم",
        variant: "destructive"
      })
    } finally {
      setDeletingContactId(null)
    }
  }

  const handleSavePhone = async (contact: ContactUser) => {
    const value = phoneDrafts[contact.id]?.trim() ?? ""

    try {
      setSavingPhoneId(contact.id)
      const response = await fetch(`/api/users/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappPhone: value || null })
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message = errorBody?.error || "تعذر حفظ الرقم"
        throw new Error(message)
      }

      const updatedContact: ContactUser = await response.json()
      const role = updatedContact.role as ManagedRole

      if (MANAGED_ROLES.includes(role)) {
        setContactGroups((current) => ({
          ...current,
          [role]: current[role].map((user) =>
            user.id === updatedContact.id ? updatedContact : user
          )
        }))
      }

      setPhoneDrafts((current) => ({
        ...current,
        [updatedContact.id]: updatedContact.whatsappPhone ?? ""
      }))

      toast({
        title: "تم الحفظ",
        description: "تم تحديث رقم واتساب بنجاح"
      })
    } catch (err) {
      console.error("Error saving contact phone:", err)
      toast({
        title: "خطأ",
        description: err instanceof Error ? err.message : "تعذر حفظ الرقم",
        variant: "destructive"
      })
    } finally {
      setSavingPhoneId(null)
    }
  }

  const handleSaveProjects = async () => {
    if (!projectDialogContact) return

    try {
      setSavingProjects(true)
      const response = await fetch(`/api/users/${projectDialogContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: projectSelection })
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        const message = errorBody?.error || "تعذر تحديث المشاريع"
        throw new Error(message)
      }

      const updatedContact: ContactUser = await response.json()
      const role = updatedContact.role as ManagedRole

      if (MANAGED_ROLES.includes(role)) {
        setContactGroups((current) => ({
          ...current,
          [role]: current[role].map((user) =>
            user.id === updatedContact.id ? updatedContact : user
          )
        }))
      }

      closeProjectDialog()

      toast({
        title: "تم الحفظ",
        description: "تم تحديث المشاريع المسندة"
      })
    } catch (err) {
      console.error("Error saving manager projects:", err)
      toast({
        title: "خطأ",
        description: err instanceof Error ? err.message : "تعذر تحديث المشاريع",
        variant: "destructive"
      })
    } finally {
      setSavingProjects(false)
    }
  }

  const totalAssigned = useMemo(
    () =>
      contactGroups.PROJECT_MANAGER.reduce(
        (acc, contact) => acc + (contact.assignedProjects?.length ?? 0),
        0
      ),
    [contactGroups.PROJECT_MANAGER]
  )

  const adminContacts = contactGroups.ADMIN
  const accountantContacts = contactGroups.ACCOUNTANT
  const projectManagers = contactGroups.PROJECT_MANAGER

  const renderEditDialog = (contact: ContactUser) => (
    <Dialog
      open={editDialogContact?.id === contact.id}
      onOpenChange={(open) => (open ? openEditDialog(contact) : closeEditDialog())}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          تعديل البيانات
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
          <DialogDescription>
            عدّل الاسم أو الدور أو قم بحذف المستخدم نهائيًا.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {editError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {editError}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`edit-name-${contact.id}`}>الاسم الكامل</Label>
            <Input
              id={`edit-name-${contact.id}`}
              value={editForm.name}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
              placeholder="اسم المستخدم"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-role-${contact.id}`}>الدور</Label>
            <select
              id={`edit-role-${contact.id}`}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={editForm.role}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  role: event.target.value as ManagedRole
                }))
              }
            >
              <option value="ADMIN">مسؤول النظام</option>
              <option value="ACCOUNTANT">محاسب</option>
              <option value="PROJECT_MANAGER">مدير مشروع</option>
            </select>
          </div>
          {editForm.role === "PROJECT_MANAGER" && (
            <div className="flex items-start gap-3 rounded-md border border-gray-200 p-3">
              <Checkbox
                id={`edit-all-projects-${contact.id}`}
                checked={editForm.canViewAllProjects}
                onCheckedChange={(value) =>
                  setEditForm((current) => ({
                    ...current,
                    canViewAllProjects: Boolean(value)
                  }))
                }
              />
              <div className="space-y-1">
                <Label htmlFor={`edit-all-projects-${contact.id}`} className="text-sm font-medium">
                  الوصول لجميع المشاريع
                </Label>
                <p className="text-xs text-gray-500">
                  فعّل الخيار إذا كان ينبغي للمدير متابعة كل المشاريع دون تخصيص.
                </p>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor={`edit-password-${contact.id}`}>كلمة مرور جديدة</Label>
            <div className="relative">
              <Input
                id={`edit-password-${contact.id}`}
                type={editPasswordVisibility.next ? "text" : "password"}
                value={editForm.newPassword}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    newPassword: event.target.value
                  }))
                }
                placeholder="أدخل كلمة المرور الجديدة"
                className="pl-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 left-2 h-auto px-2 text-muted-foreground"
                onClick={() =>
                  setEditPasswordVisibility((state) => ({
                    ...state,
                    next: !state.next
                  }))
                }
                aria-label={editPasswordVisibility.next ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {editPasswordVisibility.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500">اترك الحقل فارغًا للحفاظ على كلمة المرور الحالية.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`edit-confirm-password-${contact.id}`}>تأكيد كلمة المرور</Label>
            <div className="relative">
              <Input
                id={`edit-confirm-password-${contact.id}`}
                type={editPasswordVisibility.confirm ? "text" : "password"}
                value={editForm.confirmPassword}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value
                  }))
                }
                placeholder="أعد إدخال كلمة المرور"
                className="pl-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute inset-y-0 left-2 h-auto px-2 text-muted-foreground"
                onClick={() =>
                  setEditPasswordVisibility((state) => ({
                    ...state,
                    confirm: !state.confirm
                  }))
                }
                aria-label={editPasswordVisibility.confirm ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {editPasswordVisibility.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="destructive"
            onClick={() => void handleDeleteContact(contact)}
            disabled={deletingContactId === contact.id || savingDetails}
          >
            {deletingContactId === contact.id && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            حذف المستخدم
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeEditDialog}
              disabled={savingDetails || deletingContactId === contact.id}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSaveDetails}
              disabled={savingDetails || deletingContactId === contact.id}
            >
              {savingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              حفظ التغييرات
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const adminWithPhone = adminContacts.filter((user) => user.whatsappPhone && user.whatsappPhone.length > 0).length
  const accountantWithPhone = accountantContacts.filter((user) => user.whatsappPhone && user.whatsappPhone.length > 0).length
  const pmWithPhone = projectManagers.filter((user) => user.whatsappPhone && user.whatsappPhone.length > 0).length

  const renderRoleSection = (role: ManagedRole) => {
    const contacts = contactGroups[role]
    const metadata = ROLE_SECTIONS[role]

    if (role === "PROJECT_MANAGER") {
      return (
        <section key={role} className="space-y-4">
          <header>
            <h3 className="text-base font-semibold text-gray-900">{metadata.title}</h3>
            <p className="text-sm text-gray-500">{metadata.description}</p>
          </header>

          {contacts.length === 0 ? (
            <p className="text-sm text-gray-400">لا يوجد مديرو مشاريع حتى الآن.</p>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => {
                const assignedNames = contact.assignedProjects?.map((assignment) => assignment.project.name) ?? []

                return (
                  <div
                    key={contact.id}
                    className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 md:items-center border border-gray-100 rounded-lg p-4"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-gray-900">{contact.name}</p>
                      <p className="text-xs text-gray-500">{contact.email}</p>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">رقم واتساب</Label>
                      <Input
                        value={phoneDrafts[contact.id] ?? ""}
                        onChange={(event) =>
                          setPhoneDrafts((current) => ({
                            ...current,
                            [contact.id]: event.target.value
                          }))
                        }
                        placeholder="أدخل الرقم بصيغة دولية"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-gray-500">المشاريع المسندة</Label>
                      {assignedNames.length === 0 ? (
                        <p className="text-xs text-gray-400">لم يتم تحديد مشاريع بعد</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {assignedNames.map((name) => (
                            <Badge key={name} variant="secondary" className="text-xs">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Dialog
                        open={projectDialogContact?.id === contact.id}
                        onOpenChange={(open) => (open ? openProjectDialog(contact) : closeProjectDialog())}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            إدارة المشاريع
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>المشاريع المسندة</DialogTitle>
                            <DialogDescription>
                              اختر المشاريع التي يمكن لهذا المدير إدارتها.
                            </DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="max-h-72 pr-4">
                            <div className="space-y-2">
                              {projects.map((project) => {
                                const checked = projectSelection.includes(project.id)
                                return (
                                  <label
                                    key={project.id}
                                    className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(value) =>
                                          toggleProjectSelection(project.id, Boolean(value))
                                        }
                                      />
                                      <span>{project.name}</span>
                                    </div>
                                    {checked && (
                                      <Badge variant="outline" className="text-xs">
                                        مختار
                                      </Badge>
                                    )}
                                  </label>
                                )
                              })}
                            </div>
                          </ScrollArea>
                          <DialogFooter>
                            <Button variant="outline" onClick={closeProjectDialog}>
                              إلغاء
                            </Button>
                            <Button onClick={handleSaveProjects} disabled={savingProjects}>
                              {savingProjects && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              حفظ المشاريع
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="flex flex-col gap-2 md:items-end">
                      <div className="flex flex-wrap gap-2">
                        {renderEditDialog(contact)}
                        <Button
                          onClick={() => void handleSavePhone(contact)}
                          disabled={savingPhoneId === contact.id}
                        >
                          {savingPhoneId === contact.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          حفظ الرقم
                        </Button>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {contact.whatsappPhone ? "سيتم اعتماد الرقم بعد الحفظ" : "لم يتم تسجيل رقم بعد"}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )
    }

    return (
      <section key={role} className="space-y-4">
        <header>
          <h3 className="text-base font-semibold text-gray-900">{metadata.title}</h3>
          <p className="text-sm text-gray-500">{metadata.description}</p>
        </header>

        {contacts.length === 0 ? (
          <p className="text-sm text-gray-400">لا يوجد مستخدمون بهذا الدور حتى الآن.</p>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-3 md:items-center border border-gray-100 rounded-lg p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium text-gray-900">{contact.name}</p>
                  <p className="text-xs text-gray-500">{contact.email}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">رقم واتساب</Label>
                  <Input
                    value={phoneDrafts[contact.id] ?? ""}
                    onChange={(event) =>
                      setPhoneDrafts((current) => ({
                        ...current,
                        [contact.id]: event.target.value
                      }))
                    }
                    placeholder="أدخل الرقم بصيغة دولية"
                  />
                </div>

                <div className="flex flex-col gap-2 md:items-end">
                  <div className="flex flex-wrap gap-2">
                    {renderEditDialog(contact)}
                    <Button
                      onClick={() => void handleSavePhone(contact)}
                      disabled={savingPhoneId === contact.id}
                    >
                      {savingPhoneId === contact.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      حفظ الرقم
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {contact.whatsappPhone ? "سيتم اعتماد الرقم بعد الحفظ" : "لم يتم تسجيل رقم بعد"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  if (status === "loading" || (session && !isAdmin)) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 lg:p-12">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">أرقام WhatsApp المصرح بها</h1>
          <p className="text-gray-500">
            حدّث الأرقام التي يعتمد عليها تكامل n8n للسماح بالطلبات الواردة من الإدارة، المحاسبين، ومديري المشاريع.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="border-[#E5E7EB]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                أرقام الإدارة المسجلة
              </CardTitle>
              <CardDescription>عدد حسابات الإدارة التي تمتلك رقم واتساب صالح</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminWithPhone}</div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-600" />
                أرقام المحاسبين المسجلة
              </CardTitle>
              <CardDescription>المحاسبون القادرون على تنفيذ أوامر الاستعلام المالي</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accountantWithPhone}</div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                مدراء مشاريع برقم مسجل
              </CardTitle>
              <CardDescription>
                {pmWithPhone} من أصل {projectManagers.length} لديهم رقم فعّال
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pmWithPhone}</div>
            </CardContent>
          </Card>

          <Card className="border-[#E5E7EB]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                إجمالي الإسنادات
              </CardTitle>
              <CardDescription>عدد المشاريع المرتبطة بمديري المشاريع المصرح بهم</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssigned}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg font-semibold">إدارة جهات الاتصال المصرح بها</CardTitle>
                <CardDescription>
                  يمكن للمسؤول فقط تعديل الأرقام لضمان أن التكامل يقبل الرسائل من المستخدمين المخولين فقط.
                </CardDescription>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogChange}>
                <DialogTrigger asChild>
                  <Button className="self-start">إضافة مستخدم جديد</Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader className="space-y-2">
                    <DialogTitle>مستخدم جديد</DialogTitle>
                    <DialogDescription>
                      سجّل مستخدمًا جديدًا مع كلمة مرور مؤقتة، وسيظهر فورًا ضمن القائمة المناسبة.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {createError && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {createError}
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="new-user-name">الاسم الكامل</Label>
                      <Input
                        id="new-user-name"
                        value={createForm.name}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            name: event.target.value
                          }))
                        }
                        placeholder="اسم المستخدم"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-user-email">البريد الإلكتروني</Label>
                      <Input
                        id="new-user-email"
                        type="email"
                        value={createForm.email}
                        onChange={(event) =>
                          setCreateForm((current) => ({
                            ...current,
                            email: event.target.value
                          }))
                        }
                        placeholder="example@company.com"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-user-role">الدور</Label>
                      <select
                        id="new-user-role"
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={createForm.role}
                        onChange={(event) => handleCreateRoleChange(event.target.value as ManagedRole)}
                      >
                        <option value="ADMIN">مسؤول النظام</option>
                        <option value="ACCOUNTANT">محاسب</option>
                        <option value="PROJECT_MANAGER">مدير مشروع</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label>رقم واتساب</Label>
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <div className="flex gap-2">
                            <select
                              className="w-36 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={useCustomCountryCode ? "custom" : createForm.countryCode}
                              onChange={(event) => handleCountryCodeChange(event.target.value)}
                            >
                              {COUNTRY_CODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {useCustomCountryCode && (
                              <Input
                                className="w-28"
                                placeholder="+___"
                                value={createForm.countryCode}
                                onChange={(event) =>
                                  setCreateForm((current) => ({
                                    ...current,
                                    countryCode: event.target.value
                                  }))
                                }
                              />
                            )}
                          </div>
                          <Input
                            className="flex-1"
                            placeholder="أدخل الرقم بدون صفر البداية"
                            value={createForm.phoneNumber}
                            onChange={(event) =>
                              setCreateForm((current) => ({
                                ...current,
                                phoneNumber: event.target.value
                              }))
                            }
                          />
                        </div>
                        <p className="text-[11px] text-gray-500">
                          يتم تحويل الرقم تلقائيًا إلى الصيغة الدولية المعيارية.
                        </p>
                      </div>
                    </div>
                    {createForm.role === "PROJECT_MANAGER" && (
                      <div className="space-y-3 rounded-md border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-sm font-medium">صلاحيات المشاريع</Label>
                          <div className="flex items-center gap-2 text-sm">
                            <Checkbox
                              id="pm-all-projects"
                              checked={createForm.canViewAllProjects}
                              onCheckedChange={(value) =>
                                setCreateForm((current) => ({
                                  ...current,
                                  canViewAllProjects: Boolean(value)
                                }))
                              }
                            />
                            <label htmlFor="pm-all-projects" className="text-sm text-gray-600">
                              الوصول لجميع المشاريع
                            </label>
                          </div>
                        </div>
                        {!createForm.canViewAllProjects && (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">
                              حدّد المشاريع التي يمكن لهذا المدير إدارتها.
                            </p>
                            <ScrollArea className="max-h-48 pr-2">
                              <div className="space-y-2">
                                {projects.map((project) => {
                                  const checked = createProjectSelection.includes(project.id)
                                  return (
                                    <label
                                      key={project.id}
                                      className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(value) =>
                                            handleCreateProjectToggle(project.id, Boolean(value))
                                          }
                                        />
                                        <span>{project.name}</span>
                                      </div>
                                      {checked && (
                                        <Badge variant="outline" className="text-xs">
                                          مختار
                                        </Badge>
                                      )}
                                    </label>
                                  )
                                })}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => handleCreateDialogChange(false)} disabled={creatingUser}>
                      إلغاء
                    </Button>
                    <Button onClick={handleCreateUser} disabled={creatingUser}>
                      {creatingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      إنشاء المستخدم
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
                {error}
              </div>
            ) : (
              <div className="space-y-10">
                {MANAGED_ROLES.map((role) => (
                  <div key={role}>{renderRoleSection(role)}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
