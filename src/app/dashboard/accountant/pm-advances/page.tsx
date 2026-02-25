"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { AlertCircle, Loader2, TrendingDown, Plus } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"

interface User {
  id: string
  name: string
  email: string
}

interface Project {
  id: string
  name: string
}

interface PMAdvanceDetail {
  id: string
  user: User
  project: Project
  amount: number
  remainingAmount: number
  totalSpent: number
  spendingBreakdown: {
    unitExpenses: number
    operationalExpenses: number
  }
  percentageUsed: number
  percentageRemaining: number
  operationalExpenses: any[]
  expenses: any[]
  createdAt: string
}

export default function PMAdvancesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [advances, setAdvances] = useState<PMAdvanceDetail[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [managers, setManagers] = useState<User[]>([])
  const [formData, setFormData] = useState({
    userId: "",
    projectId: "",
    amount: ""
  })

  // Fetch PM Advances
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsFetching(true)
        const [advancesRes, projectsRes, managersRes] = await Promise.all([
          fetch("/api/pm-advances"),
          fetch("/api/projects"),
          fetch("/api/users?role=PROJECT_MANAGER")
        ])

        if (advancesRes.ok) {
          const data = await advancesRes.json()
          setAdvances(Array.isArray(data) ? data : [])
        }

        if (projectsRes.ok) {
          const data = await projectsRes.json()
          setProjects(Array.isArray(data) ? data : [])
        }

        // Get Project Managers (users with role PROJECT_MANAGER)
        if (managersRes.ok) {
          const managersData = await managersRes.json()
          setManagers(Array.isArray(managersData) ? managersData : [])
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

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.userId || !formData.projectId || !formData.amount) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreating(true)
      const response = await fetch("/api/pm-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: formData.userId,
          projectId: formData.projectId,
          amount: parseFloat(formData.amount)
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create advance")
      }

      const newAdvance = await response.json()
      
      // The API returns { message, advance }, we need advance
      const advanceData = newAdvance.advance || newAdvance
      
      // Fetch the full data including spending breakdown
      const updatedAdvancesRes = await fetch("/api/pm-advances")
      if (updatedAdvancesRes.ok) {
        const updatedAdvances = await updatedAdvancesRes.json()
        setAdvances(Array.isArray(updatedAdvances) ? updatedAdvances : [])
      }
      
      setIsDialogOpen(false)
      setFormData({ userId: "", projectId: "", amount: "" })

      toast({
        title: "نجح",
        description: "تم إنشاء العهدة بنجاح"
      })
    } catch (error) {
      console.error("Error creating advance:", error)
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "Failed to create advance",
        variant: "destructive"
      })
    } finally {
      setIsCreating(false)
    }
  }

  if (isFetching) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">عهد مديري المشاريع</h1>
          <p className="text-muted-foreground mt-2">تتبع العهد المخصصة والصرفيات من كل عهدة</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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

  const totalAllocated = advances.reduce((sum, adv) => sum + adv.amount, 0)
  const totalSpent = advances.reduce((sum, adv) => sum + adv.totalSpent, 0)
  const totalRemaining = advances.reduce((sum, adv) => sum + adv.remainingAmount, 0)

  return (
    <div className="space-y-6">
      {/* Header with Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">عهد مديري المشاريع</h1>
          <p className="text-muted-foreground mt-2">تتبع العهد المخصصة والصرفيات من كل عهدة</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة عهدة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة عهدة جديدة</DialogTitle>
              <DialogDescription>
                خصص عهدة مالية لمدير مشروع معين
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateAdvance} className="space-y-4">
              <div>
                <Label htmlFor="manager">مدير المشروع *</Label>
                <Select value={formData.userId} onValueChange={(v) => setFormData({ ...formData, userId: v })}>
                  <SelectTrigger id="manager">
                    <SelectValue placeholder="اختر مدير المشروع" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="project">المشروع *</Label>
                <Select value={formData.projectId} onValueChange={(v) => setFormData({ ...formData, projectId: v })}>
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

              <div>
                <Label htmlFor="amount">المبلغ (جنيه) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                  إضافة العهدة
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">إجمالي العهد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAllocated.toFixed(2)} جنيه</div>
            <p className="text-xs text-muted-foreground mt-1">{advances.length} عهدة نشطة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">المصروف</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSpent.toFixed(2)} جنيه</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAllocated > 0 ? ((totalSpent / totalAllocated) * 100).toFixed(1) : 0}% من الإجمالي
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">المتبقي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRemaining.toFixed(2)} جنيه</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAllocated > 0 ? ((totalRemaining / totalAllocated) * 100).toFixed(1) : 0}% من الإجمالي
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">تحذير</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {advances.filter((adv) => adv.percentageUsed >= 80).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">عهد استُنفذت أكثر من 80%</p>
          </CardContent>
        </Card>
      </div>

      {/* Advances List */}
      <div className="space-y-4">
        {advances.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>لا توجد عهد مسجلة حتى الآن</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : (
          advances.map((advance) => (
            <Card key={advance.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {advance.user.name}
                      {advance.percentageUsed >= 80 && advance.percentageUsed < 100 && (
                        <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                          تنبيه: {advance.percentageUsed.toFixed(0)}%
                        </span>
                      )}
                      {advance.percentageUsed >= 100 && (
                        <span className="inline-block px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          استُنفذت
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {advance.project.name} • العهدة منذ{" "}
                      {new Date(advance.createdAt).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{advance.amount.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">جنيه</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">نسبة الاستهلاك</span>
                    <span className="text-sm font-bold text-red-600">{advance.percentageUsed.toFixed(1)}%</span>
                  </div>
                  <Progress value={advance.percentageUsed} className="h-2" />
                </div>

                {/* Balance Breakdown */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">المصروف</p>
                    <p className="text-lg font-bold">{advance.totalSpent.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">جنيه</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">المتبقي</p>
                    <p className="text-lg font-bold text-green-600">{advance.remainingAmount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">جنيه</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">الأصلي</p>
                    <p className="text-lg font-bold">{advance.amount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">جنيه</p>
                  </div>
                </div>

                {/* Spending Breakdown */}
                <div>
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    تفصيل الصرفيات
                  </h4>

                  {/* Operational Expenses */}
                  {advance.operationalExpenses && advance.operationalExpenses.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">نفقات تشغيلية</p>
                      <div className="space-y-2 ml-4 border-r-2 border-blue-200 pr-4">
                        {advance.operationalExpenses.slice(0, 5).map((exp) => (
                          <div key={exp.id} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{exp.description}</span>
                            <span className="font-semibold">{exp.amount.toFixed(2)} جنيه</span>
                          </div>
                        ))}
                        {advance.operationalExpenses.length > 5 && (
                          <div className="text-xs text-muted-foreground italic">
                            +{advance.operationalExpenses.length - 5} نفقات أخرى
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Unit Expenses */}
                  {advance.expenses && advance.expenses.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">نفقات الوحدات</p>
                      <div className="space-y-2 ml-4 border-r-2 border-purple-200 pr-4">
                        {advance.expenses.slice(0, 5).map((exp) => (
                          <div key={exp.id} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              {exp.unit?.name || "وحدة غير محددة"} - {exp.description}
                            </span>
                            <span className="font-semibold">{exp.amount.toFixed(2)} جنيه</span>
                          </div>
                        ))}
                        {advance.expenses.length > 5 && (
                          <div className="text-xs text-muted-foreground italic">
                            +{advance.expenses.length - 5} نفقات أخرى
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!advance.operationalExpenses?.length && !advance.expenses?.length && (
                    <p className="text-sm text-muted-foreground italic">لم يتم تسجيل صرفيات بعد</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
