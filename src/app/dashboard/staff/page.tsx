"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { Users, Plus, Edit2, Trash2, Briefcase, Hammer, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

interface Staff {
  id: string
  name: string
  type: "OFFICE_STAFF" | "FIELD_WORKER"
  role: string
  phone?: string
  salary?: number
  paymentDay?: number | null
  status: string
  unit: {
    id: string
    code: string
    name: string
    project: {
      name: string
    }
  }
  projectAssignments?: {
    projectId?: string | null
    project?: {
      id: string
      name: string
    } | null
  }[]
  unitAssignments?: {
    unitId?: string | null
    unit?: {
      id: string
      name: string
      code: string
      projectId?: string | null
      project?: {
        id: string
        name: string
      } | null
    } | null
  }[]
}

const STAFF_ROLES = {
  OFFICE_STAFF: ["MANAGER", "ACCOUNTANT", "SECURITY", "CLEANER"],
  FIELD_WORKER: ["PLUMBER", "CARPENTER", "ELECTRICIAN", "PAINTER", "GENERAL_WORKER", "TECHNICIAN"],
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  MANAGER: "مدير مشروع",
  ACCOUNTANT: "محاسب",
  SECURITY: "أمن",
  CLEANER: "نظافة",
  PLUMBER: "سباك",
  CARPENTER: "نجار",
  ELECTRICIAN: "كهربائي",
  PAINTER: "دهاش",
  GENERAL_WORKER: "عامل عام",
  TECHNICIAN: "فني",
}

export default function StaffPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [units, setUnits] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [filter, setFilter] = useState<"ALL" | "OFFICE_STAFF" | "FIELD_WORKER">("ALL")

  const [formData, setFormData] = useState({
    name: "",
    type: "OFFICE_STAFF" as "OFFICE_STAFF" | "FIELD_WORKER",
    role: "",
    phone: "",
    salary: "",
    paymentDay: "",
    unitId: "",
    projectIds: [] as string[],
    unitIds: [] as string[],
  })

  const filteredUnits = useMemo(() => {
    if (!formData.projectIds.length) {
      return [] as typeof units
    }
    return units.filter((unit) => formData.projectIds.includes(unit.projectId))
  }, [units, formData.projectIds])

  useEffect(() => {
    fetchStaff()
    fetchUnits()
    fetchProjects()
  }, [])

  const fetchUnits = async () => {
    try {
      const response = await fetch("/api/operational-units")
      const data = await response.json()
      setUnits(data)
    } catch (error) {
      console.error("Error fetching units:", error)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects")
      const data = await response.json()
      setProjects(data)
    } catch (error) {
      console.error("Error fetching projects:", error)
    }
  }

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/staff")
      const data = await response.json()
      setStaff(data)
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Failed to fetch staff members",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const combinedUnitIds = Array.from(new Set([formData.unitId, ...formData.unitIds].filter(Boolean))) as string[]

    if (!formData.name || !formData.type || !formData.role || combinedUnitIds.length === 0 || !combinedUnitIds[0]) {
      toast({
        title: "خطأ",
        description: "الرجاء ملء جميع الحقول المطلوبة",
        variant: "destructive",
      })
      return
    }

    if (formData.type === "OFFICE_STAFF" && !formData.salary) {
      toast({
        title: "خطأ",
        description: "الراتب مطلوب لموظفي المكاتب",
        variant: "destructive",
      })
      return
    }

    if (formData.type === "OFFICE_STAFF" && !formData.paymentDay) {
      toast({
        title: "خطأ",
        description: "يوم الدفع مطلوب لموظفي المكاتب",
        variant: "destructive",
      })
      return
    }

    if (formData.projectIds.length === 0) {
      toast({
        title: "خطأ",
        description: "الرجاء اختيار مشروع واحد على الأقل",
        variant: "destructive",
      })
      return
    }

    try {
      const url = editingId ? `/api/staff/${editingId}` : "/api/staff"
      const method = editingId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          role: formData.role,
          phone: formData.phone || null,
          salary: formData.type === "OFFICE_STAFF" ? parseFloat(formData.salary) : null,
          paymentDay: formData.type === "OFFICE_STAFF" ? parseInt(formData.paymentDay) : null,
          unitId: combinedUnitIds[0],
          unitIds: combinedUnitIds,
          projectIds: formData.projectIds,
        }),
      })

      if (!response.ok) throw new Error("Failed to save")

      toast({
        title: "نجح",
        description: editingId ? "تم تحديث بيانات الموظف" : "تم إضافة الموظف",
      })

      setDialogOpen(false)
      resetForm()
      fetchStaff()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "خطأ",
        description: editingId ? "فشل تحديث بيانات الموظف" : "فشل إضافة الموظف",
        variant: "destructive",
      })
    }
  }

  const handleUnitToggle = (unitId: string, checked: boolean) => {
    setFormData((current) => {
      const currentSet = new Set(
        current.unitIds.length
          ? current.unitIds
          : current.unitId
          ? [current.unitId]
          : []
      )

      if (checked) {
        currentSet.add(unitId)
      } else {
        currentSet.delete(unitId)
      }

      if (currentSet.size === 0) {
        toast({
          title: "تنبيه",
          description: "يجب اختيار وحدة واحدة على الأقل",
          variant: "destructive",
        })
        return current
      }

      const allowedUnitIds = units
        .filter((unit) => current.projectIds.includes(unit.projectId))
        .map((unit) => unit.id)

      const filteredSet = new Set([...currentSet].filter((id) => allowedUnitIds.includes(id)))

      if (!filteredSet.size) {
        toast({
          title: "تنبيه",
          description: "الوحدات المختارة يجب أن تتبع المشاريع المحددة",
          variant: "destructive",
        })
        return current
      }

      let nextUnitId = current.unitId
      if (!filteredSet.has(nextUnitId)) {
        nextUnitId = [...filteredSet][0] || ""
      }

      return {
        ...current,
        unitId: nextUnitId,
        unitIds: Array.from(filteredSet),
      }
    })
  }

  const handleEdit = (member: Staff) => {
    const assignedProjectIds = Array.isArray(member.projectAssignments)
      ? member.projectAssignments
          .map((assignment) => assignment.projectId || assignment.project?.id)
          .filter((id): id is string => Boolean(id))
      : []

    const assignedUnitIds = Array.isArray(member.unitAssignments)
      ? member.unitAssignments
          .map((assignment) => assignment.unitId || assignment.unit?.id)
          .filter((id): id is string => Boolean(id))
      : []

    const primaryUnitId = member.unit?.id || assignedUnitIds[0] || ""
    const uniqueUnitIds = Array.from(new Set([primaryUnitId, ...assignedUnitIds].filter(Boolean))) as string[]

    setFormData({
      name: member.name,
      type: member.type,
      role: member.role,
      phone: member.phone || "",
      salary: member.salary ? member.salary.toString() : "",
      paymentDay:
        member.type === "OFFICE_STAFF" && member.paymentDay != null
          ? member.paymentDay.toString()
          : "",
      unitId: primaryUnitId,
      projectIds: assignedProjectIds,
      unitIds: uniqueUnitIds,
    })
    setEditingId(member.id)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/staff/${deleteId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      toast({
        title: "نجح",
        description: "تم حذف الموظف",
      })

      setDeleteId(null)
      fetchStaff()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "خطأ",
        description: "فشل حذف الموظف",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      type: "OFFICE_STAFF",
      role: "",
      phone: "",
      salary: "",
      paymentDay: "",
      unitId: "",
      projectIds: [],
      unitIds: [],
    })
    setEditingId(null)
  }

  const filteredStaff = staff.filter((member) =>
    filter === "ALL" ? true : member.type === filter
  )

  const availableRoles = STAFF_ROLES[formData.type]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة الموظفين</h1>
          <p className="text-muted-foreground mt-2">
            إدارة موظفي المكاتب والعمال الميدانيين
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" />
              إضافة موظف
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "تحرير الموظف" : "إضافة موظف جديد"}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? "تحديث تفاصيل الموظف"
                  : "إنشاء سجل موظف جديد"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">الاسم *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="أدخل اسم الموظف"
                />
              </div>

              <div>
                <Label htmlFor="type">نوع الموظف *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      type: value as "OFFICE_STAFF" | "FIELD_WORKER",
                      role: "",
                    })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFICE_STAFF">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        موظفو المكتب
                      </div>
                    </SelectItem>
                    <SelectItem value="FIELD_WORKER">
                      <div className="flex items-center gap-2">
                        <Hammer className="h-4 w-4" />
                        العامل الميداني
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="role">الدور *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="اختر دورا" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_DISPLAY_NAMES[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="phone">الهاتف (اختياري)</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="أدخل رقم الهاتف"
                />
              </div>

              {formData.type === "OFFICE_STAFF" && (
                <>
                  <div>
                    <Label htmlFor="salary">الراتب الشهري (جنيه مصري) *</Label>
                    <Input
                      id="salary"
                      type="number"
                      value={formData.salary}
                      onChange={(e) =>
                        setFormData({ ...formData, salary: e.target.value })
                      }
                      placeholder="أدخل الراتب الشهري"
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentDay">يوم الدفع (1-30) *</Label>
                    <Input
                      id="paymentDay"
                      type="number"
                      min="1"
                      max="30"
                      value={formData.paymentDay}
                      onChange={(e) =>
                        setFormData({ ...formData, paymentDay: e.target.value })
                      }
                      placeholder="أدخل يوم الدفع (1-30)"
                    />
                  </div>
                </>
              )}

              <div>
                <Label>المشاريع المعينة *</Label>
                <div className="space-y-2 mt-2 p-3 border rounded-md bg-muted">
                  {projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد مشاريع</p>
                  ) : (
                    projects.map((project) => (
                      <div key={project.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`project-${project.id}`}
                          checked={formData.projectIds.includes(project.id)}
                          onChange={(e) => {
                            const { checked } = e.target
                            setFormData((current) => {
                              const nextProjectIds = checked
                                ? Array.from(new Set([...current.projectIds, project.id]))
                                : current.projectIds.filter((id) => id !== project.id)

                              const allowedUnitIds = units
                                .filter((unit) => nextProjectIds.includes(unit.projectId))
                                .map((unit) => unit.id)

                              const nextUnitIds = current.unitIds.filter((id) => allowedUnitIds.includes(id))
                              let nextUnitId = current.unitId

                              if (!allowedUnitIds.includes(nextUnitId)) {
                                nextUnitId = nextUnitIds[0] || ""
                              }

                              return {
                                ...current,
                                projectIds: nextProjectIds,
                                unitIds: nextUnitIds,
                                unitId: nextUnitId,
                              }
                            })
                          }}
                        />
                        <Label
                          htmlFor={`project-${project.id}`}
                          className="cursor-pointer font-normal"
                        >
                          {project.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="unit">الوحدة التشغيلية الأساسية *</Label>
                <Select
                  value={formData.unitId}
                  onValueChange={(value) =>
                    setFormData((current) => {
                      const nextSet = new Set(
                        current.unitIds.length
                          ? current.unitIds
                          : current.unitId
                          ? [current.unitId]
                          : []
                      )
                      nextSet.add(value)

                      return {
                        ...current,
                        unitId: value,
                        unitIds: Array.from(nextSet),
                      }
                    })
                  }
                  disabled={filteredUnits.length === 0}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder={filteredUnits.length ? "اختر وحدة" : "اختر المشاريع أولًا"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.code} - {unit.name} ({unit.project?.name || ""})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>الوحدات المرتبطة *</Label>
                <div className="space-y-2 mt-2 p-3 border rounded-md bg-muted">
                  {!formData.projectIds.length ? (
                    <p className="text-sm text-muted-foreground">اختر مشروعًا لعرض الوحدات المتاحة.</p>
                  ) : filteredUnits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد وحدات ضمن المشاريع المحددة.</p>
                  ) : (
                    filteredUnits.map((unit) => {
                      const checkboxId = `unit-${unit.id}`
                      const isChecked = formData.unitIds.includes(unit.id)
                      return (
                        <div key={unit.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={checkboxId}
                            checked={isChecked}
                            onChange={(e) => handleUnitToggle(unit.id, e.target.checked)}
                          />
                          <Label htmlFor={checkboxId} className="cursor-pointer font-normal">
                            {unit.code} - {unit.name}
                            <span className="text-xs text-muted-foreground block">
                              {unit.project?.name || ""}
                            </span>
                          </Label>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full">
                {editingId ? "تحديث" : "إضافة"} موظف
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              جميع الموظفين
            </CardTitle>
            <Select value={filter} onValueChange={(value) => setFilter(value as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">جميع الموظفين</SelectItem>
                <SelectItem value="OFFICE_STAFF">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    موظفو المكتب
                  </div>
                </SelectItem>
                <SelectItem value="FIELD_WORKER">
                  <div className="flex items-center gap-2">
                    <Hammer className="h-4 w-4" />
                    العمال الميدانيون
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لم يتم العثور على موظفين</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>الوحدة</TableHead>
                  <TableHead>الراتب</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex w-fit gap-1">
                        {member.type === "OFFICE_STAFF" ? (
                          <Briefcase className="h-3 w-3" />
                        ) : (
                          <Hammer className="h-3 w-3" />
                        )}
                        {member.type === "OFFICE_STAFF"
                          ? "موظفو المكتب"
                          : "العامل الميداني"}
                      </Badge>
                    </TableCell>
                    <TableCell>{ROLE_DISPLAY_NAMES[member.role]}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {member.unit.code} - {member.unit.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.type === "OFFICE_STAFF"
                        ? `${member.salary?.toLocaleString()} جنيه مصري/شهر`
                        : "سعر يومي"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.status === "ACTIVE" ? "default" : "secondary"}
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(member)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={() => setDeleteId(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>حذف الموظف</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.
          </AlertDialogDescription>
          <div className="flex gap-4">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              حذف
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

