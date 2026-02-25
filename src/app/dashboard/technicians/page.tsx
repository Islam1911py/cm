"use client"

import { useState, useEffect, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { User, Plus, AlertCircle, Loader } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchBar } from "@/components/SearchBar"

interface OperationalUnit {
  id: string
  name: string
  code: string
  projectId: string
  project: {
    id: string
    name: string
  }
}

interface TechnicianWork {
  id: string
  unitId: string
  unit: OperationalUnit
  description: string
  amount: number
  isPaid: boolean
  createdAt: string
}

interface Technician {
  id: string
  name: string
  phone: string | null
  specialty: string
  notes: string | null
  createdAt: string
  works?: TechnicianWork[]
  payments?: Array<{ id: string; amount: number }>
}

interface Project {
  id: string
  name: string
}

export default function TechniciansPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [createFormData, setCreateFormData] = useState({ name: "", phone: "", specialty: "", notes: "" })

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "loading" || !session) return
    fetchTechnicians()
    fetchProjects()
  }, [session, status])

  const fetchTechnicians = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/technicians")
      if (!res.ok) throw new Error("Failed to fetch technicians")
      const data = await res.json()
      setTechnicians(data)
    } catch (err) {
      console.error("Error:", err)
      setError("Failed to load technicians")
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects")
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
    }
  }

  // Get unique projects that technicians have worked in
  const technicianProjects = useMemo(() => {
    const projectIds = new Set<string>()
    technicians.forEach(tech => {
      tech.works?.forEach(work => {
        projectIds.add(work.unit.project.id)
      })
    })
    return Array.from(projectIds)
      .map(id => projects.find(p => p.id === id))
      .filter((p): p is Project => p !== undefined)
  }, [technicians, projects])

  // Filtered technicians
  const filteredTechnicians = useMemo(() => {
    let filtered = technicians

    // Apply search filter (name or specialty)
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.specialty.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply project filter
    if (projectFilter !== "all") {
      filtered = filtered.filter(t => {
        const workedInProject = t.works?.some(work => work.unit.project.id === projectFilter)
        return workedInProject
      })
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name))

    return filtered
  }, [technicians, searchTerm, projectFilter])

  // Calculate accounting stats for each technician
  const getTechnicianStats = (tech: Technician) => {
    const earned = (tech.works || []).reduce((sum, work) => sum + work.amount, 0)
    const paid = (tech.payments || []).reduce((sum, payment) => sum + payment.amount, 0)
    const pending = earned - paid
    return { earned, paid, pending }
  }

  const handleCreateTechnician = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!createFormData.name.trim() || !createFormData.specialty.trim()) {
      alert("الرجاء ملء الحقول المطلوبة (الاسم والتخصص)")
      return
    }

    try {
      const res = await fetch("/api/technicians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createFormData.name,
          phone: createFormData.phone || null,
          specialty: createFormData.specialty,
          notes: createFormData.notes || null
        })
      })

      if (res.ok) {
        setCreateFormData({ name: "", phone: "", specialty: "", notes: "" })
        setOpenCreateDialog(false)
        fetchTechnicians()
        alert("تم إضافة الفني بنجاح")
      } else {
        const error = await res.json()
        alert(error.error || "فشل في إضافة الفني")
      }
    } catch (error) {
      console.error("Error creating technician:", error)
      alert("فشل في إضافة الفني")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الفنيون</h1>
          <p className="text-base text-gray-500 mt-2">
            إدارة الفنيين وتعيينات عملهم
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setOpenCreateDialog(true)}
            className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
          >
            <Plus className="h-4 w-4" />
            فني جديد
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search and Filters */}
      <div className="space-y-4">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="ابحث بالاسم أو التخصص..."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-48 bg-white border-gray-200">
              <SelectValue placeholder="المشروع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المشاريع</SelectItem>
              {technicianProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(searchTerm || projectFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("")
                setProjectFilter("all")
              }}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              مسح الفلاتر
            </Button>
          )}
        </div>
      </div>

      {/* Technicians Grid */}
      {filteredTechnicians.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm">
          <User className="h-16 w-16 text-gray-300 mx-auto mb-6" />
          <p className="text-xl text-gray-600 mb-6">
            {searchTerm || projectFilter !== "all"
              ? "لا يوجد فنيون مطابقون للبحث"
              : "لا يوجد فنيون"}
          </p>
          {isAdmin && !searchTerm && projectFilter === "all" && (
            <Button
              onClick={() => setOpenCreateDialog(true)}
              size="lg"
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              إضافة أول فني
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTechnicians.map((tech) => {
            const stats = getTechnicianStats(tech)
            return (
              <div
                key={tech.id}
                onClick={() => router.push(`/dashboard/technicians/${tech.id}`)}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm cursor-pointer"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {tech.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {tech.specialty}
                    </p>
                  </div>

                  {/* Accounting Stats */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">المستحق</p>
                      <p className="text-lg font-bold text-gray-900">{stats.earned.toFixed(0)}</p>
                      <p className="text-xs text-gray-400">ج.م</p>
                    </div>
                    <div className="bg-[#ECFDF5] rounded-lg p-3 border border-[#16A34A]/20">
                      <p className="text-xs text-[#16A34A] mb-1">المدفوع</p>
                      <p className="text-lg font-bold text-[#16A34A]">{stats.paid.toFixed(0)}</p>
                      <p className="text-xs text-[#16A34A]/60">ج.م</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${stats.pending > 0 ? 'bg-[#FEF2F2] border-[#DC2626]/20' : 'bg-[#ECFDF5] border-[#16A34A]/20'}`}>
                      <p className={`text-xs mb-1 ${stats.pending > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>المتبقي</p>
                      <p className={`text-lg font-bold ${stats.pending > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                        {stats.pending.toFixed(0)}
                      </p>
                      <p className={`text-xs ${stats.pending > 0 ? 'text-[#DC2626]/60' : 'text-[#16A34A]/60'}`}>ج.م</p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-1 pt-2">
                    {tech.phone && (
                      <p className="text-xs text-gray-500">
                        الهاتف: <span className="text-gray-700 font-medium">{tech.phone}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      عدد الأعمال: <span className="text-gray-700 font-medium">{tech.works?.length || 0}</span>
                    </p>
                  </div>

                  {/* Notes Preview */}
                  {tech.notes && (
                    <p className="text-xs text-gray-400 line-clamp-1 pt-2 border-t border-gray-100">
                      {tech.notes}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/technicians/${tech.id}`)
                        }}
                        className="flex-1 text-xs bg-[#2563EB]/10 hover:bg-[#2563EB]/20 text-[#2563EB] border border-[#2563EB]/20 rounded-lg px-3 py-2 font-medium"
                      >
                        عرض التفاصيل
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Technician Dialog */}
      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">إضافة فني جديد</DialogTitle>
            <DialogDescription className="text-gray-500">
              أضف فني جديد للنظام
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTechnician} className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="name" className="text-gray-700">الاسم *</Label>
                <Input
                  id="name"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  placeholder="مثال: أحمد محمد"
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <Label htmlFor="specialty" className="text-gray-700">التخصص *</Label>
                <Input
                  id="specialty"
                  value={createFormData.specialty}
                  onChange={(e) => setCreateFormData({ ...createFormData, specialty: e.target.value })}
                  placeholder="مثال: سباكة، كهرباء، نجارة"
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-gray-700">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={createFormData.phone}
                  onChange={(e) => setCreateFormData({ ...createFormData, phone: e.target.value })}
                  placeholder="مثال: 01234567890"
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <Label htmlFor="notes" className="text-gray-700">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={createFormData.notes}
                  onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                  placeholder="ملاحظات إضافية عن الفني"
                  className="bg-white border-gray-200"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenCreateDialog(false)}
                className="border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={!createFormData.name.trim() || !createFormData.specialty.trim()}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                إضافة الفني
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
