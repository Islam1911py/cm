"use client"

import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader, Plus, Building2, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchBar } from "@/components/SearchBar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"

interface Project {
  id: string
  name: string
  typeId: string
  projectType?: { id: string; name: string }
  monthlyManagementFee: number
  isActive: boolean
  createdAt: string
}

interface ProjectType {
  id: string
  name: string
  createdAt: string
}

export default function ProjectsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [createFormData, setCreateFormData] = useState({ name: "", typeId: "", monthlyManagementFee: 0 })
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null)

  const isAdmin = session?.user?.role === "ADMIN"

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    if (selectedIds.size === filteredProjects.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredProjects.map((p) => p.id)))
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkDeleteLoading(true)
    setBulkDeleteError(null)
    try {
      const res = await fetch("/api/projects/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "فشل الحذف")
      setBulkDeleteOpen(false)
      setSelectedIds(new Set())
      fetchProjects()
    } catch (err) {
      setBulkDeleteError(err instanceof Error ? err.message : "فشل الحذف الجماعي")
    } finally {
      setBulkDeleteLoading(false)
    }
  }

  useEffect(() => {
    if (status === "loading" || !session) return
    fetchProjects()
    fetchProjectTypes()
  }, [session, status])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to fetch projects")
      const data = await res.json()
      setProjects(data)
    } catch (err) {
      console.error("Error:", err)
      setError("Failed to load projects")
    } finally {
      setLoading(false)
    }
  }

  const fetchProjectTypes = async () => {
    try {
      const res = await fetch("/api/project-types")
      if (res.ok) {
        const data = await res.json()
        setProjectTypes(data)
      }
    } catch (err) {
      console.error("Error fetching project types:", err)
    }
  }

  // Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    let filtered = projects
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active"
      filtered = filtered.filter(p => p.isActive === isActive)
    }
    
    // Apply sort
    if (sortBy === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === "recent") {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    
    return filtered
  }, [projects, searchTerm, statusFilter, sortBy])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!createFormData.name.trim() || !createFormData.typeId.trim()) {
      alert("Please enter a project name and select a type")
      return
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createFormData.name,
          typeId: createFormData.typeId,
          monthlyManagementFee: createFormData.monthlyManagementFee || 0,
          isActive: true
        })
      })

      if (res.ok) {
        setCreateFormData({ name: "", typeId: "", monthlyManagementFee: 0 })
        setOpenCreateDialog(false)
        fetchProjects()
        alert("Project created successfully")
      } else {
        const error = await res.json()
        alert(error.error || "Failed to create project")
      }
    } catch (error) {
      console.error("Error creating project:", error)
      alert("Failed to create project")
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
          <h1 className="text-3xl font-bold text-gray-900">المشاريع</h1>
          <p className="text-base text-gray-500 mt-2">
            إدارة ومراقبة جميع المشاريع
          </p>
        </div>
        {isAdmin && (
          <Button 
            onClick={() => setOpenCreateDialog(true)} 
            className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
          >
            <Plus className="h-4 w-4" />
            مشروع جديد
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
          placeholder="ابحث عن المشاريع..."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-white border-gray-200">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المشاريع</SelectItem>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 bg-white border-gray-200">
              <SelectValue placeholder="ترتيب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">ترتيب حسب الاسم</SelectItem>
              <SelectItem value="recent">ترتيب حسب الحديث</SelectItem>
            </SelectContent>
          </Select>

          {(searchTerm || statusFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("")
                setStatusFilter("all")
              }}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              مسح الفلاتر
            </Button>
          )}
          {isAdmin && filteredProjects.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={selectAllFiltered}>
                {selectedIds.size === filteredProjects.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </Button>
              {selectedIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={(e) => { e.preventDefault(); setBulkDeleteError(null); setBulkDeleteOpen(true) }}
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  حذف المحدد ({selectedIds.size})
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* تأكيد حذف المشاريع المحددة */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => { setBulkDeleteOpen(o); if (!o) setBulkDeleteError(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المشاريع المحددة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف {selectedIds.size} مشروع ومشاريعهم وكل وحداتهم وبياناتهم. لا يمكن التراجع. هل أنت متأكد؟
            </AlertDialogDescription>
            {bulkDeleteError && <p className="text-sm text-red-600 font-medium">{bulkDeleteError}</p>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteLoading}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleBulkDelete() }}
              disabled={bulkDeleteLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkDeleteLoading ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm">
          <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-6" />
          <p className="text-xl text-gray-600 mb-6">
            {searchTerm || statusFilter !== "all" ? "لا توجد مشاريع تطابق الفلاتر الخاصة بك" : "لا توجد مشاريع متاحة"}
          </p>
          {isAdmin && !searchTerm && statusFilter === "all" && (
            <Button 
              onClick={() => setOpenCreateDialog(true)} 
              size="lg" 
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              إنشاء المشروع الأول
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => router.push(`/dashboard/projects/${project.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm cursor-pointer relative"
            >
              {isAdmin && (
                <div className="absolute top-4 left-4" onClick={(e) => toggleSelect(project.id, e)}>
                  <Checkbox checked={selectedIds.has(project.id)} onCheckedChange={() => {}} />
                </div>
              )}
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {project.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {project.projectType?.name || "غير محدد"}
                  </p>
                </div>

                {/* Management Fee */}
                {project.monthlyManagementFee > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">المطالبة الشهرية</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {project.monthlyManagementFee.toLocaleString('ar-EG')}
                      <span className="text-base font-normal text-gray-600 mr-1">ج.م</span>
                    </p>
                  </div>
                )}

                {/* Status Badge */}
                <div>
                  {project.isActive ? (
                    <Badge className="bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]">
                      نشط
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-600">
                      غير نشط
                    </Badge>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">انقر لعرض التفاصيل</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">إنشاء مشروع جديد</DialogTitle>
            <DialogDescription className="text-gray-500">
              قم بإنشاء مشروع جديد لتنظيم الوحدات والموارد التشغيلية
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="projectName" className="text-gray-700">اسم المشروع *</Label>
                <Input
                  id="projectName"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  placeholder="مثال: مجمع وسط المدينة"
                  className="bg-white border-gray-200"
                />
              </div>
              <div>
                <Label htmlFor="projectType" className="text-gray-700">نوع المشروع *</Label>
                <Select
                  value={createFormData.typeId}
                  onValueChange={(value) =>
                    setCreateFormData({ ...createFormData, typeId: value })
                  }
                >
                  <SelectTrigger className="bg-white border-gray-200">
                    <SelectValue placeholder="اختر نوع المشروع..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="managementFee" className="text-gray-700">المطالبة الشهرية مقابل الإدارة</Label>
                <Input
                  id="managementFee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={createFormData.monthlyManagementFee}
                  onChange={(e) => setCreateFormData({ ...createFormData, monthlyManagementFee: parseFloat(e.target.value) || 0 })}
                  placeholder="مثال: 5000"
                  className="bg-white border-gray-200"
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
                disabled={!createFormData.name.trim() || !createFormData.typeId.trim()}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                إنشاء المشروع
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
