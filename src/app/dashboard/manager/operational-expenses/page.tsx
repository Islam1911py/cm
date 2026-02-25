"use client"

import { useEffect, useMemo, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Plus } from "lucide-react"

interface Project {
  id: string
  name: string
}

interface UnitOption {
  id: string
  name: string
  code: string
  projectId: string
}

interface PMAdvance {
  id: string
  amount: number
  remainingAmount: number
  project?: { id: string; name: string } | null
  staff?: { id: string; name: string } | null
  projectId: string | null
}

interface AccountingNote {
  id: string
  amount: number
  status: "PENDING" | "CONVERTED" | "REJECTED"
  description: string
  createdAt: string
  unit: {
    id: string
    name: string
    code: string
    project: { id: string; name: string }
  }
  createdByUser: {
    id: string
    name: string
  }
  convertedToExpense?: {
    id: string
    recordedByUser: { id: string; name: string }
    recordedAt: string | null
  } | null
}

type SourceType = "OFFICE_FUND" | "PM_ADVANCE"

const ALL_PROJECTS_OPTION = "__ALL_PROJECTS__"

const defaultForm = {
  projectId: "",
  unitId: "",
  description: "",
  amount: "",
  sourceType: "OFFICE_FUND" as SourceType,
  pmAdvanceId: ""
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 2
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}

export default function ManagerOperationalExpensesPage() {
  const { toast } = useToast()

  const [projects, setProjects] = useState<Project[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [pmAdvances, setPmAdvances] = useState<PMAdvance[]>([])

  const [pendingNotes, setPendingNotes] = useState<AccountingNote[]>([])
  const [convertedNotes, setConvertedNotes] = useState<AccountingNote[]>([])

  const [formData, setFormData] = useState(defaultForm)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loadingPage, setLoadingPage] = useState(true)
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProject = useMemo(
    () => projects.find(project => project.id === formData.projectId) || null,
    [projects, formData.projectId]
  )

  useEffect(() => {
    const initialise = async () => {
      try {
        setLoadingPage(true)
        await Promise.all([fetchProjects(), fetchNotes()])
      } finally {
        setLoadingPage(false)
      }
    }

    initialise()
  }, [])

  useEffect(() => {
    if (formData.projectId) {
      fetchUnits(formData.projectId)
      fetchPmAdvances()
    } else {
      setUnits([])
      setPmAdvances([])
    }
  }, [formData.projectId])

  async function fetchProjects() {
    try {
      const response = await fetch("/api/projects")
      if (!response.ok) throw new Error("Failed to load projects")
      const data = await response.json()
      const mapped = (Array.isArray(data) ? data : []).map((project: any) => ({
        id: project.id,
        name: project.name as string
      }))
      setProjects(mapped)
    } catch (err) {
      console.error("Error fetching projects", err)
      toast({
        title: "خطأ",
        description: "تعذر تحميل المشاريع",
        variant: "destructive"
      })
    }
  }

  async function fetchUnits(projectId: string) {
    try {
      const response = await fetch(`/api/operational-units?projectId=${projectId}`)
      if (!response.ok) throw new Error("Failed to load units")
      const data = await response.json()
      const mapped = (Array.isArray(data) ? data : []).map((unit: any) => ({
        id: unit.id,
        name: unit.name,
        code: unit.code,
        projectId: unit.projectId
      }))
      setUnits(mapped)
    } catch (err) {
      console.error("Error fetching units", err)
      toast({
        title: "خطأ",
        description: "تعذر تحميل الوحدات",
        variant: "destructive"
      })
    }
  }

  async function fetchPmAdvances() {
    try {
      const response = await fetch(`/api/pm-advances`)
      if (!response.ok) throw new Error("Failed to load advances")
      const data = await response.json()
      setPmAdvances(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error("Error fetching PM advances", err)
      toast({
        title: "تنبيه",
        description: "تعذر تحميل العهد المالية",
        variant: "destructive"
      })
    }
  }

  async function fetchNotes(projectId?: string) {
    try {
      setLoadingNotes(true)
      const urls = ["PENDING", "CONVERTED"].map(status => {
        const params = new URLSearchParams()
        params.set("status", status)
        if (projectId) params.set("projectId", projectId)
        return `/api/accounting-notes?${params.toString()}`
      })

      const [pendingRes, convertedRes] = await Promise.all([
        fetch(urls[0]),
        fetch(urls[1])
      ])

      if (!pendingRes.ok) throw new Error("Failed to load pending notes")
      if (!convertedRes.ok) throw new Error("Failed to load converted notes")

      const [pendingData, convertedData] = await Promise.all([
        pendingRes.json(),
        convertedRes.json()
      ])

      setPendingNotes(Array.isArray(pendingData) ? pendingData : [])
      setConvertedNotes(Array.isArray(convertedData) ? convertedData : [])
      setError(null)
    } catch (err) {
      console.error("Error fetching notes", err)
      setError("تعذر تحميل النفقات المسجلة")
    } finally {
      setLoadingNotes(false)
    }
  }

  const filteredPmAdvances = useMemo(() => {
    if (!formData.projectId) return []
    return pmAdvances
  }, [pmAdvances, formData.projectId])

  const pendingForSelectedProject = useMemo(() => {
    if (!formData.projectId) return pendingNotes
    return pendingNotes.filter(note => note.unit.project.id === formData.projectId)
  }, [pendingNotes, formData.projectId])

  const convertedForSelectedProject = useMemo(() => {
    if (!formData.projectId) return convertedNotes
    return convertedNotes.filter(note => note.unit.project.id === formData.projectId)
  }, [convertedNotes, formData.projectId])

  const canSubmit =
    formData.projectId &&
    formData.unitId &&
    formData.description.trim().length > 0 &&
    formData.amount.trim().length > 0 &&
    (formData.sourceType === "OFFICE_FUND" || formData.pmAdvanceId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    try {
      setSubmitting(true)
      const projectIdForRefresh = formData.projectId
      const payload: any = {
        unitId: formData.unitId,
        description: formData.description.trim(),
        amount: Number(formData.amount),
        sourceType: formData.sourceType
      }

      if (formData.sourceType === "PM_ADVANCE") {
        payload.pmAdvanceId = formData.pmAdvanceId
      }

      const response = await fetch("/api/operational-expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || "تعذر تسجيل النفقة")
      }

      toast({
        title: "تم الحفظ",
        description: "تم إرسال النفقة للمراجعة المحاسبية"
      })

      setDialogOpen(false)
      setFormData({ ...defaultForm, projectId: projectIdForRefresh })
      await fetchNotes(projectIdForRefresh)
    } catch (err) {
      toast({
        title: "خطأ",
        description: err instanceof Error ? err.message : "تعذر تسجيل النفقة",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const statusBadge: Record<AccountingNote["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    PENDING: { label: "قيد المراجعة", variant: "secondary" },
    CONVERTED: { label: "مسجلة", variant: "default" },
    REJECTED: { label: "مرفوضة", variant: "destructive" }
  }

  if (loadingPage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">النفقات التشغيلية</h1>
          <p className="text-muted-foreground">إدارة وإرسال نفقات المشاريع المسندة إليك</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(key => (
            <Card key={key}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">النفقات التشغيلية</h1>
          <p className="text-muted-foreground">
            أرسل مصروفات الوحدات ليتم مراجعتها من فريق المحاسبة
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={open => {
            setDialogOpen(open)
            if (!open) {
              setFormData(current => ({ ...defaultForm, projectId: current.projectId }))
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              نفقة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>تسجيل نفقة تشغيلية</DialogTitle>
              <DialogDescription>
                ستظهر هذه النفقة في ملاحظات المحاسب للمراجعة والاعتماد
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project">المشروع *</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={value => setFormData(current => ({ ...current, projectId: value, unitId: "", pmAdvanceId: "" }))}
                >
                  <SelectTrigger id="project">
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">الوحدة *</Label>
                <Select
                  value={formData.unitId}
                  onValueChange={value => setFormData(current => ({ ...current, unitId: value }))}
                  disabled={!formData.projectId}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder={formData.projectId ? "اختر الوحدة" : "اختر المشروع أولًا"} />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name} ({unit.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">وصف النفقة *</Label>
                <Input
                  id="description"
                  placeholder="مثال: شراء مستلزمات صيانة للوحدة"
                  value={formData.description}
                  onChange={event => setFormData(current => ({ ...current, description: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">المبلغ (ر.س) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={event => setFormData(current => ({ ...current, amount: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">مصدر النفقة *</Label>
                <Select
                  value={formData.sourceType}
                  onValueChange={value => setFormData(current => ({ ...current, sourceType: value as SourceType, pmAdvanceId: "" }))}
                >
                  <SelectTrigger id="source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFICE_FUND">من صندوق المكتب</SelectItem>
                    <SelectItem value="PM_ADVANCE">من عهدة مدير المشروع</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.sourceType === "PM_ADVANCE" && (
                <div className="space-y-2">
                  <Label htmlFor="advance">اختر العهدة *</Label>
                  <Select
                    value={formData.pmAdvanceId}
                    onValueChange={value => setFormData(current => ({ ...current, pmAdvanceId: value }))}
                  >
                    <SelectTrigger id="advance">
                      <SelectValue placeholder={filteredPmAdvances.length ? "اختر العهدة" : "لا توجد عهد متاحة"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPmAdvances.map(advance => (
                        <SelectItem key={advance.id} value={advance.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{advance.staff?.name || "مدير مشروع"}</span>
                            <span className="text-xs text-muted-foreground">
                              متبقي {formatCurrency(
                                typeof advance.remainingAmount === "number" ? advance.remainingAmount : Number(advance.amount) || 0
                              )}
                              {advance.project?.name ? ` • مرتبط بـ ${advance.project.name}` : ""}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={!canSubmit || submitting}>
                  {submitting ? "جاري الإرسال..." : "إرسال للمحاسب"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>مستخلص سريع</CardTitle>
          <CardDescription>
            اختر مشروعًا لرؤية النفقات المرتبطة به أو اتركه فارغًا لعرض جميع النفقات التي قمت بتسجيلها
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Label className="text-sm font-medium">تصفية حسب المشروع</Label>
              <Select
                value={formData.projectId || ALL_PROJECTS_OPTION}
                onValueChange={value => {
                  const nextProjectId = value === ALL_PROJECTS_OPTION ? "" : value
                  setFormData(current => ({ ...current, projectId: nextProjectId, unitId: "", pmAdvanceId: "" }))
                  fetchNotes(nextProjectId)
                }}
              >
                <SelectTrigger className="md:w-72">
                  <SelectValue placeholder="كل المشاريع المسندة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROJECTS_OPTION}>كل المشاريع</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">
              يظهر هنا كل ما أرسلته للمحاسب إضافة إلى ما تم اعتماده
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>نفقات قيد المراجعة</CardTitle>
            <CardDescription>هذه النفقات تنتظر اعتماد فريق المحاسبة</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingNotes ? (
              <div className="space-y-2">
                {[1, 2, 3].map(key => (
                  <Skeleton key={key} className="h-14 w-full" />
                ))}
              </div>
            ) : pendingForSelectedProject.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد نفقات قيد الانتظار حاليًا.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>تاريخ الإرسال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingForSelectedProject.map(note => (
                    <TableRow key={note.id}>
                      <TableCell>
                        <div className="font-medium">{note.unit.name}</div>
                        <div className="text-xs text-muted-foreground">{note.unit.project.name}</div>
                      </TableCell>
                      <TableCell>{formatCurrency(note.amount)}</TableCell>
                      <TableCell className="max-w-xs truncate">{note.description}</TableCell>
                      <TableCell>{formatDate(note.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>نفقات معتمدة</CardTitle>
            <CardDescription>نفقات تم تسجيلها في النظام بعد مراجعة المحاسب</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingNotes ? (
              <div className="space-y-2">
                {[1, 2, 3].map(key => (
                  <Skeleton key={key} className="h-14 w-full" />
                ))}
              </div>
            ) : convertedForSelectedProject.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم يتم اعتماد نفقات لهذا الاختيار بعد.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convertedForSelectedProject.map(note => (
                    <TableRow key={note.id}>
                      <TableCell>
                        <div className="font-medium">{note.unit.name}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</div>
                      </TableCell>
                      <TableCell>{formatCurrency(note.amount)}</TableCell>
                      <TableCell className="max-w-xs truncate">{note.description}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge[note.status].variant}>
                          {statusBadge[note.status].label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
