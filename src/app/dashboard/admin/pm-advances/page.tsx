"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"

import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

const NO_PROJECT_VALUE = "__NO_PROJECT__"

interface StaffMember {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
}

interface PMAdvanceDetail {
  id: string
  staff: StaffMember
  project: Project | null
  amount: number
  remainingAmount: number
  totalSpent: number
  spendingBreakdown: {
    unitExpenses: number
    operationalExpenses: number
  }
  percentageUsed: number
  percentageRemaining: number
  operationalExpenses?: Array<{
    id: string
    description: string
    amount: number
    unit?: {
      name?: string | null
      project?: { name?: string | null } | null
    } | null
  }>
  expenses?: Array<{
    id: string
    description: string
    amount: number
    unit?: {
      name?: string | null
      project?: { name?: string | null } | null
    } | null
  }>
  createdAt: string
}

interface StaffAdvanceGroup {
  staffId: string
  staffName: string
  totalAmount: number
  totalSpent: number
  totalRemaining: number
  percentageUsed: number
  advances: PMAdvanceDetail[]
}

type FormState = {
  staffId: string
  projectId: string
  amount: string
}

export default function PMAdvancesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [advances, setAdvances] = useState<PMAdvanceDetail[]>([])
  const [isFetching, setIsFetching] = useState(true)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<FormState>({ staffId: "", projectId: "", amount: "" })
  const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false)

  const [projects, setProjects] = useState<Project[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAdvance, setEditingAdvance] = useState<PMAdvanceDetail | null>(null)
  const [editFormData, setEditFormData] = useState({ amount: "", projectId: "" })
  const [isUpdating, setIsUpdating] = useState(false)

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [advanceToDelete, setAdvanceToDelete] = useState<PMAdvanceDetail | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null)

  const canManageAdvances = session?.user?.role === "ADMIN" || session?.user?.role === "ACCOUNTANT"

  // 1. Fetch Logic
  const refreshAdvances = useCallback(async () => {
    try {
      const response = await fetch("/api/pm-advances")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setAdvances(Array.isArray(data) ? data : [])
    } catch (error) {
      toast({
        title: "خطأ",
        description: "تعذر تحديث قائمة العهد.",
        variant: "destructive",
      })
    }
  }, [toast])

  useEffect(() => {
    const loadData = async () => {
      setIsFetching(true)
      try {
        await Promise.all([
          refreshAdvances(),
          fetch("/api/projects").then(res => res.json()).then(data => setProjects(data)),
          fetch("/api/staff").then(res => res.json()).then(data => setStaffMembers(data)),
        ])
      } catch (error) {
        console.error(error)
      } finally {
        setIsFetching(false)
      }
    }
    loadData()
  }, [refreshAdvances])

  // 2. Calculations (Fixing undefined variables)
  const { totalAllocated, totalSpent, totalRemaining, highUsageCount } = useMemo(() => {
    return advances.reduce(
      (acc, adv) => {
        acc.totalAllocated += adv.amount
        acc.totalSpent += adv.totalSpent
        acc.totalRemaining += adv.remainingAmount
        if (adv.percentageUsed >= 80) acc.highUsageCount++
        return acc
      },
      { totalAllocated: 0, totalSpent: 0, totalRemaining: 0, highUsageCount: 0 }
    )
  }, [advances])

  // 3. Grouping Logic (Fixing the broken useMemo)
  const groupedAdvances = useMemo<StaffAdvanceGroup[]>(() => {
    const groups = new Map<string, StaffAdvanceGroup>()
    advances.forEach((advance) => {
      const existing = groups.get(advance.staff.id)
      if (existing) {
        existing.totalAmount += advance.amount
        existing.totalSpent += advance.totalSpent
        existing.totalRemaining += advance.remainingAmount
        existing.advances.push(advance)
        existing.percentageUsed = (existing.totalSpent / existing.totalAmount) * 100
      } else {
        groups.set(advance.staff.id, {
          staffId: advance.staff.id,
          staffName: advance.staff.name,
          totalAmount: advance.amount,
          totalSpent: advance.totalSpent,
          totalRemaining: advance.remainingAmount,
          percentageUsed: advance.percentageUsed,
          advances: [advance],
        })
      }
    })
    return Array.from(groups.values())
  }, [advances])

  // 4. Handlers (Fixing missing functions)
  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const res = await fetch("/api/pm-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error()
      toast({ title: "تمت الإضافة", description: "تم تخصيص العهدة بنجاح." })
      setIsDialogOpen(false)
      setFormData({ staffId: "", projectId: "", amount: "" })
      refreshAdvances()
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في إضافة العهدة.", variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAdvance) return
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/pm-advances/${editingAdvance.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      })
      if (!res.ok) throw new Error()
      setIsEditDialogOpen(false)
      refreshAdvances()
      toast({ title: "تم التحديث", description: "تم تعديل بيانات العهدة." })
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في التحديث.", variant: "destructive" })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteAdvance = async () => {
    if (!advanceToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/pm-advances/${advanceToDelete.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setIsDeleteDialogOpen(false)
      refreshAdvances()
      toast({ title: "تم الحذف", description: "تم حذف العهدة نهائياً." })
    } catch (error) {
      toast({ title: "خطأ", description: "تعذر حذف العهدة.", variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditDialogChange = (open: boolean) => setIsEditDialogOpen(open)
  const handleDeleteDialogChange = (open: boolean) => setIsDeleteDialogOpen(open)

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardHeader><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-32" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">عهد الموظفين</h1>
          <p className="mt-2 text-muted-foreground">تتبع العهد المخصصة لكل موظف ومراقبة الصرفيات والمتبقي لحظياً.</p>
        </div>
        {canManageAdvances && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> إضافة عهدة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة عهدة جديدة</DialogTitle>
                <DialogDescription>خصص عهدة مالية لأي موظف مع إمكانية ربطها بمشروع محدد.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateAdvance} className="space-y-4">
                <div className="space-y-2">
                  <Label>الموظف *</Label>
                  <Popover open={isStaffPickerOpen} onOpenChange={setIsStaffPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {formData.staffId ? staffMembers.find((m) => m.id === formData.staffId)?.name : "اختر الموظف"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput placeholder="ابحث عن الموظف..." />
                        <CommandList>
                          <CommandEmpty>لا يوجد موظفون</CommandEmpty>
                          <CommandGroup>
                            {staffMembers.map((member) => (
                              <CommandItem key={member.id} onSelect={() => { setFormData({ ...formData, staffId: member.id }); setIsStaffPickerOpen(false) }}>
                                <Check className={cn("ml-2 h-4 w-4", member.id === formData.staffId ? "opacity-100" : "opacity-0")} />
                                {member.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>المبلغ (جنيه) *</Label>
                  <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>المشروع (اختياري)</Label>
                  <Select value={formData.projectId || NO_PROJECT_VALUE} onValueChange={(v) => setFormData({ ...formData, projectId: v === NO_PROJECT_VALUE ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT_VALUE}>بدون مشروع</SelectItem>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} إضافة العهدة
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">إجمالي العهد</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAllocated.toFixed(2)} جنيه</div>
            <p className="text-xs text-muted-foreground">{groupedAdvances.length} موظفاً لديهم عهد</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">المصروف</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSpent.toFixed(2)} جنيه</div>
            <p className="text-xs text-muted-foreground">الصرف التشغيلي والوحدات معاً</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">المتبقي</CardTitle></CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", totalRemaining < 0 ? "text-red-600" : "text-green-600")}>
              {totalRemaining.toFixed(2)} جنيه
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600">تنبيهات الاستهلاك</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{highUsageCount}</div></CardContent>
        </Card>
      </div>

      {/* Main List */}
      <div className="space-y-4">
        {groupedAdvances.length === 0 ? (
          <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>لا توجد عهد مسجلة</AlertDescription></Alert>
        ) : (
          groupedAdvances.map((group) => (
            <Card key={group.staffId}>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setExpandedStaffId(expandedStaffId === group.staffId ? null : group.staffId)}>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>{group.staffName}</CardTitle>
                    <CardDescription>{group.advances.length} عهدة قائمة</CardDescription>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-lg">{group.totalAmount.toFixed(2)} ج.م</div>
                    <div className="text-sm text-muted-foreground">الإجمالي</div>
                  </div>
                </div>
                <Progress value={group.percentageUsed} className="mt-4 h-2" />
              </CardHeader>

              {expandedStaffId === group.staffId && (
                <CardContent className="pt-4 border-t space-y-4">
                  {group.advances.map((advance) => (
                    <div key={advance.id} className="p-4 border rounded-lg bg-muted/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold">{advance.project?.name || "بدون مشروع"}</div>
                          <div className="text-xs text-muted-foreground">بتاريخ: {new Date(advance.createdAt).toLocaleDateString("ar-EG")}</div>
                        </div>
                        <div className="flex items-center gap-2">
                                              <div className="text-left">
                              <div className="font-bold">{advance.amount.toFixed(2)}</div>
                                                <div className="text-xs font-semibold text-muted-foreground">متبقي: {advance.remainingAmount.toFixed(2)}</div>
                           </div>
                           <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => { setEditingAdvance(advance); setEditFormData({ amount: advance.amount.toString(), projectId: advance.project?.id || "" }); setIsEditDialogOpen(true) }}>
                                  <Pencil className="ml-2 h-4 w-4" /> تعديل
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => { setAdvanceToDelete(advance); setIsDeleteDialogOpen(true) }}>
                                  <Trash2 className="ml-2 h-4 w-4" /> حذف
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                           </DropdownMenu>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">إجمالي المصروف: {(advance.totalSpent ?? 0).toFixed(2)} ج.م</span>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">تشغيلي: {(advance.spendingBreakdown?.operationalExpenses ?? 0).toFixed(2)}</span>
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">مصروفات وحدات: {(advance.spendingBreakdown?.unitExpenses ?? 0).toFixed(2)}</span>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground">مصروفات تشغيلية مسجلة</h4>
                            {advance.operationalExpenses && advance.operationalExpenses.length > 0 ? (
                              <ul className="space-y-1 text-xs">
                                {advance.operationalExpenses.slice(0, 4).map((expense) => (
                                  <li key={expense.id} className="flex items-center justify-between rounded bg-background/60 px-3 py-2">
                                    <div className="flex-1 pr-3">
                                      <p className="truncate font-medium text-sm">{expense.description || "مصروف بدون وصف"}</p>
                                      {(expense.unit?.project || expense.unit) && (
                                        <p className="mt-1 text-[10px] text-muted-foreground">
                                          {expense.unit?.project ? expense.unit.project.name : ""}
                                          {expense.unit?.project && expense.unit?.name ? " • " : ""}
                                          {expense.unit?.name ? `وحدة ${expense.unit.name}` : ""}
                                        </p>
                                      )}
                                    </div>
                                    <span className="font-semibold text-xs">{expense.amount.toFixed(2)}</span>
                                  </li>
                                ))}
                                {advance.operationalExpenses.length > 4 && (
                                  <li className="text-[11px] text-muted-foreground">+ {advance.operationalExpenses.length - 4} عناصر إضافية</li>
                                )}
                              </ul>
                            ) : (
                              <p className="text-xs text-muted-foreground">لا توجد مصروفات تشغيلية مسجلة بعد</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground">مصروفات وحدات</h4>
                            {advance.expenses && advance.expenses.length > 0 ? (
                              <ul className="space-y-1 text-xs">
                                {advance.expenses.slice(0, 4).map((expense) => (
                                  <li key={expense.id} className="flex items-center justify-between rounded bg-background/60 px-3 py-2">
                                    <div className="flex-1 pr-3">
                                      <p className="truncate font-medium text-sm">{expense.description || "مصروف بدون وصف"}</p>
                                      {(expense.unit?.project || expense.unit) && (
                                        <p className="mt-1 text-[10px] text-muted-foreground">
                                          {expense.unit?.project ? expense.unit.project.name : ""}
                                          {expense.unit?.project && expense.unit?.name ? " • " : ""}
                                          {expense.unit?.name ? `وحدة ${expense.unit.name}` : ""}
                                        </p>
                                      )}
                                    </div>
                                    <span className="font-semibold text-xs">{expense.amount.toFixed(2)}</span>
                                  </li>
                                ))}
                                {advance.expenses.length > 4 && (
                                  <li className="text-[11px] text-muted-foreground">+ {advance.expenses.length - 4} عناصر إضافية</li>
                                )}
                              </ul>
                            ) : (
                              <p className="text-xs text-muted-foreground">لم تُسجل مصروفات وحدات بعد</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل العهدة</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>المبلغ المعدل</Label>
              <Input type="number" step="0.01" value={editFormData.amount} onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isUpdating}>{isUpdating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} حفظ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم حذف سجل هذه العهدة نهائياً. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAdvance} className="bg-red-600">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}