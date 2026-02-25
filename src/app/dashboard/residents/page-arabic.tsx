"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Users, Plus, Edit, MapPin, Phone, Mail, Loader, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
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

interface Resident {
  id: string
  name: string
  phone: string
  email: string
  address: string
  unit: {
    id: string
    code: string
    name: string
    project: {
      id: string
      name: string
    }
  }
}

interface OperationalUnit {
  id: string
  code: string
  name: string
  isActive: boolean
  projectId: string
}

interface Project {
  id: string
  name: string
  operationalUnits: OperationalUnit[]
}

export default function ResidentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [residents, setResidents] = useState<Resident[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [selectedUnitId, setSelectedUnitId] = useState<string>("")
  const [filterUnit, setFilterUnit] = useState<string>("")

  const isPM = session?.user?.role === "PROJECT_MANAGER"
  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "loading" || !session) return
    if (!isPM && !isAdmin) {
      router.replace("/dashboard")
      return
    }

    fetchData()
  }, [status, session])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch projects with their units
      const projectsRes = await fetch("/api/projects")
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()
        setProjects(projectsData)
      }

      // Fetch residents
      const residentsRes = await fetch("/api/residents")
      if (residentsRes.ok) {
        const residentsData = await residentsRes.json()
        setResidents(residentsData)
      } else {
        throw new Error("Failed to fetch residents")
      }
    } catch (err) {
      console.error("Error:", err)
      setError("فشل تحميل البيانات")
    } finally {
      setLoading(false)
    }
  }

  // Get all unique units from residents
  const uniqueUnits = Array.from(
    new Map(residents.map(r => [r.unit?.id, r.unit])).values()
  ).sort((a, b) => (a?.code || "").localeCompare(b?.code || "", "ar"))

  // Filter residents by unit
  const filteredResidents = filterUnit
    ? residents.filter(r => r.unit?.id === filterUnit)
    : residents

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            السكان
          </h1>
          <p className="text-gray-500 mt-1">إدارة سكان الوحدات السكنية والعقارات</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          إضافة ساكن
        </Button>
      </div>

      {/* Filters Card */}
      {uniqueUnits.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">التصفية والبحث</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 block mb-2">اختر الوحدة</label>
                <Select value={filterUnit} onValueChange={setFilterUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="جميع الوحدات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">جميع الوحدات ({residents.length})</SelectItem>
                    {uniqueUnits.map(unit => {
                      const unitCount = residents.filter(r => r.unit?.id === unit?.id).length
                      return (
                        <SelectItem key={unit?.id} value={unit?.id || ""}>
                          {unit?.code} - {unit?.name} ({unitCount})
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              {filterUnit && (
                <Button 
                  variant="outline" 
                  onClick={() => setFilterUnit("")}
                  className="px-4"
                >
                  مسح
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm">إجمالي السكان</p>
              <p className="text-3xl font-bold mt-2">{filteredResidents.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm">الوحدات</p>
              <p className="text-3xl font-bold mt-2">{uniqueUnits.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm">المشاريع</p>
              <p className="text-3xl font-bold mt-2">{projects.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Residents Table */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة السكان</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredResidents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto opacity-50 mb-2" />
              <p>لا توجد بيانات سكان</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-bold">الاسم</TableHead>
                    <TableHead className="font-bold">رقم الهاتف</TableHead>
                    <TableHead className="font-bold">البريد الإلكتروني</TableHead>
                    <TableHead className="font-bold">الوحدة</TableHead>
                    <TableHead className="font-bold">المشروع</TableHead>
                    <TableHead className="font-bold">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResidents.map(resident => (
                    <TableRow key={resident.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{resident.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          {resident.phone || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {resident.email || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-blue-50">
                          {resident.unit?.code} - {resident.unit?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {resident.unit?.project?.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Edit className="h-4 w-4" />
                          تعديل
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة ساكن جديد</DialogTitle>
            <DialogDescription>
              أدخل بيانات الساكن الجديد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">اختر المشروع</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
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

            {selectedProjectId && (
              <div>
                <label className="text-sm font-medium block mb-2">اختر الوحدة</label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الوحدة" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects
                      .find(p => p.id === selectedProjectId)
                      ?.operationalUnits.map(unit => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.code} - {unit.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setIsAddDialogOpen(false)}
                className="flex-1"
              >
                إلغاء
              </Button>
              <Button 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
