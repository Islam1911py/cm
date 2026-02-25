"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Building2, Plus, AlertCircle, Loader } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { SearchBar } from "@/components/SearchBar"

interface Project {
  id: string
  name: string
  type: string
}

interface OperationalUnit {
  id: string
  name: string
  code: string
  type: string
  projectId: string
  isActive: boolean
  project: Project
}

export default function OperationalUnitsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get("projectId")
  const { data: session, status } = useSession()
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [createFormData, setCreateFormData] = useState({ name: "", code: "", type: "", projectId: "" })

  const [projects, setProjects] = useState<Project[]>([])
  const [units, setUnits] = useState<OperationalUnit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")

  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "loading" || !session) return
    fetchProjects()
    fetchUnits()
  }, [session, status])

  useEffect(() => {
    if (projectIdParam) {
      setProjectFilter(projectIdParam)
      setCreateFormData((prev) => ({ ...prev, projectId: projectIdParam }))
      setOpenCreateDialog(true)
    }
  }, [projectIdParam])

  const selectedProject = projects.find((p) => p.id === createFormData.projectId)

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

  const fetchUnits = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/operational-units")
      if (res.ok) {
        const data = await res.json()
        setUnits(data)
      } else {
        setError("Failed to load operational units")
      }
    } catch (error) {
      console.error("Error fetching units:", error)
      setError("Error loading operational units")
    } finally {
      setLoading(false)
    }
  }

  // Filtered and sorted units
  const filteredUnits = useMemo(() => {
    let filtered = units

    // Apply search filter (name or code)
    if (searchTerm) {
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply project filter
    if (projectFilter !== "all") {
      filtered = filtered.filter(u => u.projectId === projectFilter)
    }

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter(u => u.isActive === true)
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter(u => u.isActive === false)
    }

    // Sort by name
    filtered.sort((a, b) => a.name.localeCompare(b.name))

    return filtered
  }, [units, searchTerm, projectFilter, statusFilter])

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!createFormData.projectId || !createFormData.name || !createFormData.code || !createFormData.type) {
      alert("Please fill in all required fields")
      return
    }

    try {
      const payload = {
        ...createFormData,
        isActive: true
      }

      const res = await fetch("/api/operational-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setCreateFormData({ name: "", code: "", type: "", projectId: "" })
        setOpenCreateDialog(false)
        fetchUnits()
        alert("Operational unit created successfully")
      } else {
        const data = await res.json()
        alert(data.error || "Failed to create operational unit")
      }
    } catch (error) {
      console.error("Error creating unit:", error)
      alert("Error creating operational unit")
    }
  }

  if (loading && units.length === 0) {
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
          <h1 className="text-3xl font-bold text-gray-900">الوحدات التشغيلية</h1>
          <p className="text-base text-gray-500 mt-2">
            إدارة جميع الوحدات التشغيلية عبر المشاريع
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setOpenCreateDialog(true)}
            className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
          >
            <Plus className="h-4 w-4" />
            إضافة وحدة
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
          placeholder="ابحث بالاسم أو الكود..."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-48 bg-white border-gray-200">
              <SelectValue placeholder="المشروع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المشاريع</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 bg-white border-gray-200">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الوحدات</SelectItem>
              <SelectItem value="active">نشطة</SelectItem>
              <SelectItem value="inactive">غير نشطة</SelectItem>
            </SelectContent>
          </Select>

          {(searchTerm || projectFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("")
                setProjectFilter("all")
                setStatusFilter("active")
              }}
              className="border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              مسح الفلاتر
            </Button>
          )}
        </div>
      </div>

      {/* Units Grid */}
      {filteredUnits.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm">
          <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-6" />
          <p className="text-xl text-gray-600 mb-6">
            {searchTerm || projectFilter !== "all" || statusFilter !== "all"
              ? "لا توجد وحدات تطابق الفلاتر"
              : "لا توجد وحدات تشغيلية"}
          </p>
          {isAdmin && !searchTerm && projectFilter === "all" && statusFilter === "all" && (
            <Button
              onClick={() => setOpenCreateDialog(true)}
              size="lg"
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              إضافة أول وحدة
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map((unit) => (
            <div
              key={unit.id}
              onClick={() => router.push(`/dashboard/operational-units/${unit.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm cursor-pointer"
            >
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {unit.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Code: {unit.code}
                  </p>
                </div>

                {/* Project and Type */}
                <div className="space-y-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-500">
                    المشروع: <span className="text-gray-700 font-medium">{unit.project.name}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    النوع: <span className="text-gray-700 font-medium">{unit.type}</span>
                  </p>
                </div>

                {/* Status Badge */}
                <div>
                  {unit.isActive ? (
                    <Badge className="bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]">
                      نشطة
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-600">
                      غير نشطة
                    </Badge>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">اضغط لعرض التفاصيل</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Unit Dialog */}
      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">إضافة وحدة تشغيلية جديدة</DialogTitle>
            <DialogDescription className="text-gray-500">
              إنشاء وحدة تشغيلية جديدة داخل مشروع
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUnit} className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="project" className="text-gray-700">المشروع *</Label>
                {projectIdParam ? (
                  <Input
                    id="project"
                    value={selectedProject?.name || "جاري تحميل المشروع..."}
                    readOnly
                    className="bg-gray-50 border-gray-200 text-gray-900"
                  />
                ) : (
                  <Select
                    value={createFormData.projectId}
                    onValueChange={(value) => setCreateFormData({ ...createFormData, projectId: value })}
                  >
                    <SelectTrigger className="bg-white border-gray-200">
                      <SelectValue placeholder="اختر المشروع" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label htmlFor="name" className="text-gray-700">اسم الوحدة *</Label>
                <Input
                  id="name"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  placeholder="مثال: عمارة 8"
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <Label htmlFor="code" className="text-gray-700">كود الوحدة *</Label>
                <Input
                  id="code"
                  value={createFormData.code}
                  onChange={(e) => setCreateFormData({ ...createFormData, code: e.target.value })}
                  placeholder="مثال: UNIT-001"
                  className="bg-white border-gray-200"
                />
              </div>

              <div>
                <Label htmlFor="type" className="text-gray-700">نوع الوحدة *</Label>
                <Input
                  id="type"
                  value={createFormData.type}
                  onChange={(e) => setCreateFormData({ ...createFormData, type: e.target.value })}
                  placeholder="مثال: شقة، مكتب"
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
                disabled={!createFormData.projectId || !createFormData.name || !createFormData.code || !createFormData.type}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                إضافة الوحدة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
