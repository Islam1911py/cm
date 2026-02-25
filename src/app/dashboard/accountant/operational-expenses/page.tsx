"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { AlertCircle, Plus, Loader2, Wallet, FileText } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion"

interface OperationalUnit {
  id: string
  name: string
  code: string
  type: string
  projectId?: string
}

interface Project {
  id: string
  name: string
}

interface PMAdvanceSummary {
  id: string
  staff?: { id: string; name: string }
  project?: { id: string; name: string } | null
  amount: number
  remainingAmount: number
  givenAt?: string
  totalSpent?: number
  spendingBreakdown?: {
    unitExpenses: number
    operationalExpenses: number
  }
  percentageUsed?: number
  percentageRemaining?: number
  operationalExpenses?: OperationalExpenseSummary[]
  expenses?: UnitExpenseSummary[]
}

interface OperationalExpense {
  id: string
  unitId: string
  description: string
  amount: number
  sourceType: "OFFICE_FUND" | "PM_ADVANCE"
  pmAdvanceId?: string
  recordedByUser: { id: string; name: string; email: string }
  recordedAt: string
  unit: OperationalUnit
  pmAdvance?: PMAdvanceSummary | null
}

interface OperationalExpenseSummary {
  id: string
  description: string
  amount: number
  unit?: OperationalUnit
  recordedAt?: string
}

interface UnitExpenseSummary {
  id: string
  description: string
  amount: number
  unit?: OperationalUnit
  date?: string
}

interface AccountingNote {
  id: string
  projectId: string
  unitId: string
  description: string
  amount: number
  status: "PENDING" | "CONVERTED" | "REJECTED"
  sourceType: "OFFICE_FUND" | "PM_ADVANCE"
  pmAdvanceId?: string | null
  createdAt: string
  convertedAt?: string | null
  unit: OperationalUnit
  project?: Project | null
  createdByUser: { id: string; name: string; email: string }
  pmAdvance?: PMAdvanceSummary | null
  convertedToExpense?: (OperationalExpense & { claimInvoiceId?: string | null }) | null
}

export default function OperationalExpensesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [sourceType, setSourceType] = useState<"OFFICE_FUND" | "PM_ADVANCE">("OFFICE_FUND")

  const [projects, setProjects] = useState<Project[]>([])
  const [units, setUnits] = useState<OperationalUnit[]>([])
  const [pmAdvances, setPmAdvances] = useState<PMAdvanceSummary[]>([])
  const [expenses, setExpenses] = useState<OperationalExpense[]>([])
  const [notes, setNotes] = useState<AccountingNote[]>([])

  const [formData, setFormData] = useState({
    projectId: "",
    unitId: "",
    description: "",
    amount: "",
    pmAdvanceId: ""
  })
  const [selectedAdvanceStaffId, setSelectedAdvanceStaffId] = useState("")

  const pendingNotes = useMemo(
    () => notes.filter((note) => note.status === "PENDING"),
    [notes]
  )

  const totalPendingAmount = useMemo(
    () => pendingNotes.reduce((sum, note) => sum + note.amount, 0),
    [pendingNotes]
  )

  const totalConvertedAmount = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  )

  const officeFundConverted = useMemo(
    () =>
      expenses
        .filter((expense) => expense.sourceType === "OFFICE_FUND")
        .reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  )

  const pmAdvanceConverted = useMemo(
    () =>
      expenses
        .filter((expense) => expense.sourceType === "PM_ADVANCE")
        .reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  )

  const pmAdvanceOptions = useMemo(() => {
    const map = new Map<
      string,
      {
        staffId: string
        staffName: string
        totalAmount: number
        totalRemaining: number
        advances: PMAdvanceSummary[]
      }
    >()

    pmAdvances.forEach((advance) => {
      const staffId = advance.staff?.id ?? advance.id
      const staffName = advance.staff?.name ?? "بدون اسم"
      if (!map.has(staffId)) {
        map.set(staffId, {
          staffId,
          staffName,
          totalAmount: 0,
          totalRemaining: 0,
          advances: []
        })
      }

      const group = map.get(staffId)!
      group.totalAmount += advance.amount
      group.totalRemaining += advance.remainingAmount
      group.advances.push(advance)
    })

    return Array.from(map.values())
      .map((group) => {
        const advancesSorted = [...group.advances].sort((a, b) => {
          const remainingDiff = b.remainingAmount - a.remainingAmount
          if (remainingDiff !== 0) return remainingDiff
          const dateA = a.givenAt ? new Date(a.givenAt).getTime() : 0
          const dateB = b.givenAt ? new Date(b.givenAt).getTime() : 0
          return dateB - dateA
        })
        const primaryAdvance = advancesSorted.find((adv) => adv.remainingAmount > 0) ?? null
        return {
          ...group,
          advances: advancesSorted,
          primaryAdvanceId: primaryAdvance ? primaryAdvance.id : null
        }
      })
      .filter((group) => group.advances.length > 0)
      .map(({ primaryAdvanceId, ...group }) => group)
      .sort((a, b) => a.staffName.localeCompare(b.staffName, "ar", { sensitivity: "base" }))
  }, [pmAdvances])

  const resolveAdvanceId = useCallback(
    (staffId: string, amountValue: number) => {
      const option = pmAdvanceOptions.find((item) => item.staffId === staffId)
      if (!option) {
        return ""
      }

      const amount = Number(amountValue)
      const advances = option.advances
      if (advances.length === 0) {
        return ""
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        const positive = advances.find((adv) => adv.remainingAmount > 0)
        return positive ? positive.id : advances[0].id
      }

      const exactMatch = advances.find((adv) => adv.remainingAmount >= amount)
      if (exactMatch) {
        return exactMatch.id
      }

      const withBalance = advances.find((adv) => adv.remainingAmount > 0)
      return withBalance ? withBalance.id : advances[0].id
    },
    [pmAdvanceOptions]
  )

  const selectedStaffOption = useMemo(
    () => pmAdvanceOptions.find((item) => item.staffId === selectedAdvanceStaffId) ?? null,
    [pmAdvanceOptions, selectedAdvanceStaffId]
  )

  const currentAdvance = useMemo(() => {
    if (!selectedStaffOption || !formData.pmAdvanceId) {
      return null
    }
    return selectedStaffOption.advances.find((adv) => adv.id === formData.pmAdvanceId) ?? null
  }, [selectedStaffOption, formData.pmAdvanceId])

  const projectedRemaining = useMemo(() => {
    if (!currentAdvance) {
      return null
    }
    const amountValue = Number(formData.amount)
    if (!Number.isFinite(amountValue)) {
      return currentAdvance.remainingAmount
    }
    return currentAdvance.remainingAmount - amountValue
  }, [currentAdvance, formData.amount])

  useEffect(() => {
    if (!isOpen) {
      setSelectedAdvanceStaffId("")
      setFormData((prev) => (prev.pmAdvanceId ? { ...prev, pmAdvanceId: "" } : prev))
    }
  }, [isOpen])

  useEffect(() => {
    if (sourceType !== "PM_ADVANCE") {
      if (selectedAdvanceStaffId) {
        setSelectedAdvanceStaffId("")
      }
      if (formData.pmAdvanceId) {
        setFormData((prev) => (prev.pmAdvanceId ? { ...prev, pmAdvanceId: "" } : prev))
      }
      return
    }

    if (!selectedAdvanceStaffId) {
      if (formData.pmAdvanceId) {
        setFormData((prev) => (prev.pmAdvanceId ? { ...prev, pmAdvanceId: "" } : prev))
      }
      return
    }

    const numericAmount = parseFloat(formData.amount)
    const candidateId = resolveAdvanceId(selectedAdvanceStaffId, numericAmount)

    if (candidateId && candidateId !== formData.pmAdvanceId) {
      setFormData((prev) => ({ ...prev, pmAdvanceId: candidateId }))
    }
  }, [sourceType, selectedAdvanceStaffId, formData.amount, formData.pmAdvanceId, resolveAdvanceId, selectedStaffOption])

  const pmAdvanceGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        staffId: string
        staffName: string
        totalAmount: number
        totalRemaining: number
        advances: PMAdvanceSummary[]
        operationalExpenses: OperationalExpenseSummary[]
        unitExpenses: UnitExpenseSummary[]
      }
    >()

    pmAdvances.forEach((advance) => {
      const staffId = advance.staff?.id ?? advance.id
      const staffName = advance.staff?.name ?? "بدون اسم"

      if (!groups.has(staffId)) {
        groups.set(staffId, {
          staffId,
          staffName,
          totalAmount: 0,
          totalRemaining: 0,
          advances: [],
          operationalExpenses: [],
          unitExpenses: []
        })
      }

      const group = groups.get(staffId)!
      group.totalAmount += advance.amount
      group.totalRemaining += advance.remainingAmount
      group.advances.push(advance)

      if (advance.operationalExpenses) {
        group.operationalExpenses.push(...advance.operationalExpenses)
      }

      if (advance.expenses) {
        group.unitExpenses.push(...advance.expenses)
      }
    })

    return Array.from(groups.values()).map((group) => ({
      ...group,
      advances: [...group.advances].sort((a, b) => {
        const dateA = a.givenAt ? new Date(a.givenAt).getTime() : 0
        const dateB = b.givenAt ? new Date(b.givenAt).getTime() : 0
        return dateB - dateA
      }),
      operationalExpenses: [...group.operationalExpenses].sort((a, b) => {
        const dateA = a.recordedAt ? new Date(a.recordedAt).getTime() : 0
        const dateB = b.recordedAt ? new Date(b.recordedAt).getTime() : 0
        return dateB - dateA
      }),
      unitExpenses: [...group.unitExpenses].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0
        const dateB = b.date ? new Date(b.date).getTime() : 0
        return dateB - dateA
      })
    }))
  }, [pmAdvances])

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsFetching(true)

        const [projectsRes, unitsRes, advancesRes, notesRes, expensesRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/operational-units"),
          fetch("/api/pm-advances"),
          fetch("/api/accounting-notes"),
          fetch("/api/operational-expenses")
        ])

        if (projectsRes.ok) {
          const projectsData = await projectsRes.json()
          setProjects(Array.isArray(projectsData) ? projectsData : [])
        }

        if (unitsRes.ok) {
          const unitsData = await unitsRes.json()
          setUnits(Array.isArray(unitsData) ? unitsData : [])
        }

        if (advancesRes.ok) {
          const advancesData = await advancesRes.json()
          setPmAdvances(Array.isArray(advancesData) ? advancesData : [])
        }

        if (notesRes.ok) {
          const notesData = await notesRes.json()
          setNotes(Array.isArray(notesData) ? notesData : [])
        }

        if (expensesRes.ok) {
          const expensesData = await expensesRes.json()
          setExpenses(Array.isArray(expensesData) ? expensesData : [])
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load data. Please refresh the page.",
          variant: "destructive"
        })
      } finally {
        setIsFetching(false)
      }
    }

    fetchData()
  }, [toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.projectId || !formData.unitId || !formData.description || !formData.amount) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }
    // Additional validation: ensure unitId exists in the units array
    const selectedUnit = units.find(u => u.id === formData.unitId)
    if (!selectedUnit) {
      toast({
        title: "Error",
        description: "Invalid unit selection. Please select a valid unit.",
        variant: "destructive"
      })
      return
    }
    if (sourceType === "PM_ADVANCE" && !formData.pmAdvanceId) {
      toast({
        title: "Validation Error",
        description: "Please select an advance when using PM_ADVANCE source.",
        variant: "destructive"
      })
      return
    }

    try {
      setIsLoading(true)

      const payload = {
        unitId: formData.unitId,
        description: formData.description,
        amount: parseFloat(formData.amount),
        sourceType,
        ...(sourceType === "PM_ADVANCE" && { pmAdvanceId: formData.pmAdvanceId })
      }

      const response = await fetch("/api/operational-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create expense")
      }

      const result = await response.json()

      if (result?.accountingNote) {
        setNotes((prev) => [result.accountingNote, ...prev])
      } else {
        const notesRes = await fetch("/api/accounting-notes")
        if (notesRes.ok) {
          const notesData = await notesRes.json()
          setNotes(Array.isArray(notesData) ? notesData : [])
        }
      }

      // Update expenses list (converted items may have changed from other actions)
      const expensesRes = await fetch("/api/operational-expenses")
      if (expensesRes.ok) {
        const expensesData = await expensesRes.json()
        setExpenses(Array.isArray(expensesData) ? expensesData : [])
      }

      // Refresh PM Advances if using one
      if (sourceType === "PM_ADVANCE") {
        const advancesRes = await fetch("/api/pm-advances")
        if (advancesRes.ok) {
          const advancesData = await advancesRes.json()
          setPmAdvances(Array.isArray(advancesData) ? advancesData : [])
        }
      }

      setIsOpen(false)
      setFormData({ projectId: "", unitId: "", description: "", amount: "", pmAdvanceId: "" })
      setSourceType("OFFICE_FUND")

      toast({
        title: "تم تسجيل النفقة",
        description: "تم إرسال النفقة للمراجعة المحاسبية"
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create expense",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">نفقات تشغيلية</h1>
          <p className="text-muted-foreground mt-2">إدارة نفقات الوحدات من صندوق المكتب أو العهد</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const handleDialogOpen = async (newOpen: boolean) => {
    if (newOpen && !isOpen) {
      // When opening the dialog, refresh the data
      try {
        const [expensesRes, advancesRes, notesRes] = await Promise.all([
          fetch("/api/operational-expenses"),
          fetch("/api/pm-advances"),
          fetch("/api/accounting-notes")
        ])

        if (expensesRes.ok) {
          const expensesData = await expensesRes.json()
          setExpenses(Array.isArray(expensesData) ? expensesData : [])
        }

        if (advancesRes.ok) {
          const advancesData = await advancesRes.json()
          setPmAdvances(Array.isArray(advancesData) ? advancesData : [])
        }

        if (notesRes.ok) {
          const notesData = await notesRes.json()
          setNotes(Array.isArray(notesData) ? notesData : [])
        }
      } catch (error) {
        console.error("Error refreshing data:", error)
      }
    }
    setIsOpen(newOpen)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">نفقات تشغيلية</h1>
          <p className="text-muted-foreground mt-2">إدارة نفقات الوحدات من صندوق المكتب أو العهد</p>
        </div>
        <Dialog open={isOpen} onOpenChange={handleDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              نفقة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>نفقة تشغيلية جديدة</DialogTitle>
              <DialogDescription>
                أضف نفقة تشغيلية جديدة من صندوق المكتب أو من عهدة مدير المشروع
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Project Selection */}
              <div className="space-y-2">
                <Label htmlFor="project">المشروع *</Label>
                <Select value={formData.projectId} onValueChange={(v) => {
                  setFormData({ ...formData, projectId: v, unitId: "" })
                }}>
                  <SelectTrigger id="project">
                    <SelectValue placeholder="اختر المشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unit Selection */}
              <div className="space-y-2">
                <Label htmlFor="unit">الوحدة *</Label>
                <Select value={formData.unitId} onValueChange={(v) => setFormData({ ...formData, unitId: v })} disabled={!formData.projectId}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="اختر الوحدة" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.projectId && units
                      .filter((unit) => unit.projectId === formData.projectId)
                      .map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name} ({unit.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">الوصف *</Label>
                <Input
                  id="description"
                  placeholder="مثال: شراء أدوات، دفع فاتورة، إلخ"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">المبلغ *</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              {/* Source Type */}
              <div className="space-y-2">
                <Label htmlFor="sourceType">مصدر النفقة *</Label>
                <Select value={sourceType} onValueChange={(v: any) => setSourceType(v)}>
                  <SelectTrigger id="sourceType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFICE_FUND">من صندوق المكتب</SelectItem>
                    <SelectItem value="PM_ADVANCE">من عهدة مدير المشروع</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* PM Advance Selection (conditional) */}
              {sourceType === "PM_ADVANCE" && (
                <div className="space-y-2">
                  <Label htmlFor="pmAdvance">عهدة مدير المشروع *</Label>
                  <Select
                    value={selectedAdvanceStaffId}
                    onValueChange={(staffId) => {
                      setSelectedAdvanceStaffId(staffId)
                      const numericAmount = parseFloat(formData.amount)
                      const candidateId = resolveAdvanceId(staffId, numericAmount)
                      setFormData((prev) =>
                        prev.pmAdvanceId === candidateId ? prev : { ...prev, pmAdvanceId: candidateId }
                      )
                    }}
                    disabled={pmAdvanceOptions.length === 0}
                  >
                    <SelectTrigger id="pmAdvance">
                      <SelectValue placeholder={pmAdvanceOptions.length === 0 ? "لا توجد عهد متاحة" : "اختر مدير المشروع"} />
                    </SelectTrigger>
                    <SelectContent>
                      {pmAdvanceOptions.length === 0 ? (
                        <SelectItem value="__empty" disabled>
                          لا توجد عهد متاحة
                        </SelectItem>
                      ) : (
                        pmAdvanceOptions.map((option) => (
                          <SelectItem key={option.staffId} value={option.staffId}>
                            {option.staffName} (متبقي إجمالي: {option.totalRemaining.toFixed(2)})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {selectedStaffOption && (
                    <div className="mt-2 space-y-1 rounded-lg bg-blue-50 p-3 text-sm">
                      <div>
                        المتبقي الإجمالي: <span className="font-bold">{selectedStaffOption.totalRemaining.toFixed(2)} ج.م</span>
                      </div>
                      {currentAdvance ? (
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>
                            سيتم خصم النفقة من عهدة برصيد {currentAdvance.remainingAmount.toFixed(2)} ج.م
                            {currentAdvance.project?.name ? ` • ${currentAdvance.project.name}` : ""}
                          </div>
                          {projectedRemaining !== null && (
                            <div className={projectedRemaining < 0 ? "text-red-600" : "text-muted-foreground"}>
                              الرصيد بعد الخصم: {projectedRemaining.toFixed(2)} ج.م
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">أدخل مبلغًا لاختيار العهدة المناسبة تلقائيًا.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  حفظ النفقة
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* PM Advance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            عهد مديري المشاريع
          </CardTitle>
          <CardDescription>راقب العهد المتاحة وسجل الصرفيات المرتبطة بكل مدير</CardDescription>
        </CardHeader>
        <CardContent>
          {pmAdvanceGroups.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>لا توجد عهد مسجلة حالياً</AlertDescription>
            </Alert>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {pmAdvanceGroups.map((group) => (
                <AccordionItem key={group.staffId} value={group.staffId}>
                  <AccordionTrigger className="justify-between">
                    <div className="flex flex-col items-start text-right">
                      <span className="font-semibold text-base">{group.staffName}</span>
                      <span className="text-xs text-muted-foreground">
                        إجمالي العهد: {group.totalAmount.toFixed(2)} • المتبقي: {group.totalRemaining.toFixed(2)} جنيه
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          سجل العهد المصروفة
                        </h4>
                        {group.advances.length === 0 ? (
                          <p className="text-xs text-muted-foreground">لا توجد صرفيات مسجلة على العهد</p>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {group.advances.map((advance) => (
                              <li
                                key={advance.id}
                                className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2"
                              >
                                <span className="text-muted-foreground text-xs">
                                  {advance.givenAt
                                    ? new Date(advance.givenAt).toLocaleDateString("ar-EG", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric"
                                      })
                                    : "—"}
                                </span>
                                <span className="font-semibold">
                                  {advance.amount.toFixed(2)} جنيه
                                </span>
                                <span className="text-xs text-green-700">
                                  المتبقي {advance.remainingAmount.toFixed(2)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">صرفيات مسجلة على العهد</h4>
                        {group.operationalExpenses.length === 0 && group.unitExpenses.length === 0 ? (
                          <p className="text-xs text-muted-foreground">لم يتم تسجيل صرفيات من العهد بعد</p>
                        ) : (
                          <div className="space-y-3">
                            {group.operationalExpenses.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">نفقات تشغيلية</p>
                                <ul className="space-y-1 text-sm">
                                  {group.operationalExpenses.slice(0, 5).map((expense) => (
                                    <li key={expense.id} className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        {expense.unit?.name ?? "وحدة غير محددة"} - {expense.description}
                                      </span>
                                      <span className="font-semibold">{expense.amount.toFixed(2)} جنيه</span>
                                    </li>
                                  ))}
                                  {group.operationalExpenses.length > 5 && (
                                    <li className="text-xs text-muted-foreground">
                                      +{group.operationalExpenses.length - 5} نفقات أخرى
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                            {group.unitExpenses.length > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">نفقات وحدات</p>
                                <ul className="space-y-1 text-sm">
                                  {group.unitExpenses.slice(0, 5).map((expense) => (
                                    <li key={expense.id} className="flex justify-between">
                                      <span className="text-muted-foreground">
                                        {expense.unit?.name ?? "وحدة غير محددة"} - {expense.description}
                                      </span>
                                      <span className="font-semibold">{expense.amount.toFixed(2)} جنيه</span>
                                    </li>
                                  ))}
                                  {group.unitExpenses.length > 5 && (
                                    <li className="text-xs text-muted-foreground">
                                      +{group.unitExpenses.length - 5} نفقات إضافية
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">نفقات قيد المراجعة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalPendingAmount.toFixed(2)} جنيه
            </div>
            <p className="text-xs text-muted-foreground mt-1">{pendingNotes.length} طلب قيد الاعتماد</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">نفقات معتمدة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalConvertedAmount.toFixed(2)} جنيه
            </div>
            <p className="text-xs text-muted-foreground mt-1">{expenses.length} نفقة تمت مراجعتها</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">من العهد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pmAdvanceConverted.toFixed(2)} جنيه
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {expenses.filter((exp) => exp.sourceType === "PM_ADVANCE").length} نفقة
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">من صندوق المكتب</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {officeFundConverted.toFixed(2)} جنيه
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {expenses.filter((exp) => exp.sourceType === "OFFICE_FUND").length} نفقة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notes + Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>سجل النفقات وملاحظات المراجعة</CardTitle>
          <CardDescription>يتضمن الطلبات المرسلة والحالات المعتمدة أو المرفوضة</CardDescription>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>لا توجد ملاحظات محاسبية مسجلة حتى الآن</AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>المصدر</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>أنشئ بواسطة</TableHead>
                    <TableHead>آخر تحديث</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notes.map((note) => {
                    const statusStyles: Record<
                      AccountingNote["status"],
                      { label: string; className: string }
                    > = {
                      PENDING: {
                        label: "قيد المراجعة",
                        className: "bg-yellow-100 text-yellow-800"
                      },
                      CONVERTED: {
                        label: "معتمدة",
                        className: "bg-green-100 text-green-800"
                      },
                      REJECTED: {
                        label: "مرفوضة",
                        className: "bg-red-100 text-red-800"
                      }
                    }

                    const status = statusStyles[note.status]
                    const sourceLabel =
                      note.sourceType === "OFFICE_FUND"
                        ? "صندوق المكتب"
                        : `عهدة ${note.pmAdvance?.staff?.name ?? "غير محددة"}`

                    const lastUpdated = note.status === "CONVERTED"
                      ? note.convertedAt || note.convertedToExpense?.recordedAt || note.createdAt
                      : note.createdAt

                    const unitName = note.unit?.name ?? "وحدة غير معروفة"
                    const unitCode = note.unit?.code ?? "—"

                    return (
                      <TableRow key={note.id}>
                        <TableCell className="font-medium">
                          {unitName} ({unitCode})
                        </TableCell>
                        <TableCell>{note.description}</TableCell>
                        <TableCell className="font-bold">{note.amount.toFixed(2)} جنيه</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-medium">
                            {sourceLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span className="font-semibold text-sm">{note.createdByUser.name}</span>
                            {note.status === "CONVERTED" && note.convertedToExpense?.recordedByUser && (
                              <span className="text-muted-foreground">
                                اعتمدت بواسطة: {note.convertedToExpense.recordedByUser.name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(lastUpdated).toLocaleDateString("ar-EG", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
