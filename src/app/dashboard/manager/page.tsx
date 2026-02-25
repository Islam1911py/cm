"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Ticket,
  Package,
  FileText,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DashboardStats {
  tickets: {
    total: number
    new: number
    inProgress: number
    done: number
  }
  deliveryOrders: {
    total: number
    new: number
    inProgress: number
    delivered: number
  }
  pendingAccountingNotes: number
}

interface ProjectOption {
  id: string
  name: string
}

interface UnitOption {
  id: string
  name: string
  code: string
  projectId: string
}

export default function ProjectManagerDashboardPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountingNoteOpen, setAccountingNoteOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [formData, setFormData] = useState({
    projectId: "",
    unitId: "",
    amount: "",
    reason: "",
    notes: ""
  })

  useEffect(() => {
    fetchStats()
    fetchProjects()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/dashboard/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true)
      const response = await fetch("/api/projects")
      if (!response.ok) return
      const data = await response.json()
      const mapped = (Array.isArray(data) ? data : []).map((project) => ({
        id: project.id,
        name: project.name,
      }))
      setProjects(mapped)
    } catch (error) {
      console.error("Error fetching projects:", error)
    } finally {
      setLoadingProjects(false)
    }
  }

  const fetchUnits = async (projectId: string) => {
    try {
      setLoadingUnits(true)
      const response = await fetch(`/api/operational-units?projectId=${projectId}`)
      if (!response.ok) return
      const data = await response.json()
      const mapped = (Array.isArray(data) ? data : []).map((unit) => ({
        id: unit.id,
        name: unit.name,
        code: unit.code,
        projectId: unit.projectId,
      }))
      setUnits(mapped)
    } catch (error) {
      console.error("Error fetching units:", error)
    } finally {
      setLoadingUnits(false)
    }
  }

  const handleSubmitAccountingNote = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (!formData.projectId || !formData.unitId) {
        toast({
          variant: "destructive",
          title: "خطأ",
          description: "اختر المشروع والوحدة أولاً"
        })
        return
      }

      const reason = formData.reason.trim()
      const notes = formData.notes.trim()
      const description = notes ? `${reason}\nملاحظات: ${notes}` : reason

      const response = await fetch("/api/accounting-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: formData.projectId,
          unitId: formData.unitId,
          description,
          amount: parseFloat(formData.amount)
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Accounting note submitted successfully"
        })
        setAccountingNoteOpen(false)
        setFormData({ projectId: "", unitId: "", amount: "", reason: "", notes: "" })
        fetchStats()
      } else {
        throw new Error("Failed to submit accounting note")
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit accounting note"
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">لوحة تحكم مدير المشروع</h1>
        <p className="text-muted-foreground">
          أهلا بعودتك، {session?.user.name}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              الشكاوى
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {loading ? <Skeleton className="h-6 w-12 mx-auto" /> : stats?.tickets.new || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">جديد</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    {loading ? <Skeleton className="h-6 w-12 mx-auto" /> : stats?.tickets.inProgress || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">نشط</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    {loading ? <Skeleton className="h-6 w-12 mx-auto" /> : stats?.tickets.done || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">مكتمل</div>
                </div>
              </div>
              <Button className="w-full" variant="outline" asChild>
                <a href="/dashboard/tickets">عرض جميع التذاكر</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              أوامر التوصيل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {loading ? <Skeleton className="h-6 w-12 mx-auto" /> : stats?.deliveryOrders.new || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">New</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                    {loading ? <Skeleton className="h-6 w-12 mx-auto" /> : stats?.deliveryOrders.inProgress || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    {loading ? <Skeleton className="h-6 w-12 mx-auto" /> : stats?.deliveryOrders.delivered || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">تم التوصيل</div>
                </div>
              </div>
              <Button className="w-full" variant="outline" asChild>
                <a href="/dashboard/delivery-orders">عرض جميع الطلبات</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              ملاحظات محاسبية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                  {loading ? <Skeleton className="h-8 w-16 mx-auto" /> : stats?.pendingAccountingNotes || 0}
                </div>
                <div className="text-sm text-muted-foreground">ملاحظات قيد الانتظار</div>
              </div>
              <Dialog open={accountingNoteOpen} onOpenChange={setAccountingNoteOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Send Accounting Note
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إرسال ملاحظة محاسبية</DialogTitle>
                    <DialogDescription>
                      إرسال ملاحظة محاسبية عن نفقات نقدية دفعتها أنت
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitAccountingNote} className="space-y-4">
                    <div className="space-y-2">
                      <Label>المشروع</Label>
                      <Select
                        value={formData.projectId}
                        onValueChange={(value) => {
                          setFormData({ ...formData, projectId: value, unitId: "" })
                          fetchUnits(value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingProjects ? "جاري التحميل..." : "اختر المشروع"} />
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
                    <div className="space-y-2">
                      <Label>الوحدة التشغيلية</Label>
                      <Select
                        value={formData.unitId}
                        onValueChange={(value) => setFormData({ ...formData, unitId: value })}
                        disabled={!formData.projectId || loadingUnits}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              loadingUnits
                                ? "جاري التحميل..."
                                : formData.projectId
                                  ? "اختر الوحدة"
                                  : "اختر المشروع أولاً"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name} ({unit.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">المبلغ</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reason">السبب</Label>
                      <Textarea
                        id="reason"
                        required
                        value={formData.reason}
                        onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                        placeholder="صف المصروفات..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">ملاحظات إضافية (اختياري)</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="أي تفاصيل إضافية..."
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setAccountingNoteOpen(false)}>
                        إلغاء
                      </Button>
                      <Button type="submit">إرسال</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>              <Button className="w-full" variant="outline" asChild>
                <a href="/dashboard/manager/operational-expenses">عرض جميع النفقات المسجلة</a>
              </Button>            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>النشاط الأخير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">تم تحديث النظام</p>
                <p className="text-xs text-muted-foreground">تم تحديث لوحة التحكم بأحدث البيانات</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">أهلا بك في لوحة التحكم الخاصة بك</p>
                <p className="text-xs text-muted-foreground">استخدم البطاقات أعلاه لإدارة مشاريعك</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
