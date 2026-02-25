"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { AlertCircle, ArrowRight, Loader, Users, Ticket, HardHat, Building2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface UnitTicket {
  id: string
  title: string
  status: string
  description?: string | null
  createdAt: string
  resident?: {
    id: string
    name: string
    phone?: string | null
  } | null
}

interface UnitStaff {
  id: string
  name: string
  phone?: string | null
  role: string
  type: "OFFICE_STAFF" | "FIELD_WORKER"
  status: string
  unitId?: string | null
  unit?: {
    id: string
    name: string
  } | null
}

interface OperationalUnit {
  id: string
  name: string
  code: string
  type: string
  monthlyManagementFee?: number | null
  monthlyBillingDay?: number | null
  isActive: boolean
  tickets?: UnitTicket[]
  staff?: UnitStaff[]
  staffUnitAssignments?: {
    staff: UnitStaff | null
  }[]
  residents?: UnitResident[]
}

interface UnitResident {
  id: string
  name: string
  phone?: string | null
  whatsappPhone?: string | null
}

type SectionType = "residents" | "tickets" | "staff"

type DetailsView =
  | { scope: "unit"; section: SectionType; unit: OperationalUnit }
  | { scope: "project"; section: SectionType }

interface StaffDirectoryEntry {
  id: string
  name: string
  phone?: string | null
  role: string
  type: UnitStaff["type"]
  units: { id: string; name: string; code: string }[]
}

interface Project {
  id: string
  name: string
  type: string
  monthlyBillingDay?: number | null
  isActive: boolean
  createdAt: string
  operationalUnits: OperationalUnit[]
}

const STAFF_ROLE_LABELS: Record<string, string> = {
  MANAGER: "مدير مشروع",
  ACCOUNTANT: "محاسب",
  SECURITY: "أمن",
  CLEANER: "نظافة",
  PLUMBER: "سباك",
  CARPENTER: "نجار",
  ELECTRICIAN: "كهربائي",
  PAINTER: "دهان",
  GENERAL_WORKER: "عامل عام",
  TECHNICIAN: "فني",
}

const STAFF_TYPE_LABELS: Record<UnitStaff["type"], string> = {
  OFFICE_STAFF: "موظف مكتبي",
  FIELD_WORKER: "عامل ميداني",
}

const TICKET_STATUS_LABELS: Record<string, string> = {
  NEW: "جديدة",
  IN_PROGRESS: "قيد التنفيذ",
  COMPLETED: "مكتملة",
  CLOSED: "مغلقة",
  RESOLVED: "مغلقة",
}

export default function ProjectDetailsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailsView, setDetailsView] = useState<DetailsView | null>(null)
  const [sectionSearch, setSectionSearch] = useState("")

  const isAdmin = session?.user?.role === "ADMIN"
  const canViewFinancialDetails =
    session?.user?.role === "ADMIN" || session?.user?.role === "ACCOUNTANT"

  const getUnitStaff = (unit: OperationalUnit): UnitStaff[] => {
    const direct = unit.staff ?? []
    const assignmentStaff = (unit.staffUnitAssignments ?? [])
      .map((assignment) => assignment.staff)
      .filter((staff): staff is UnitStaff => Boolean(staff))

    const combined = [...direct, ...assignmentStaff]
    const unique = new Map<string, UnitStaff>()
    combined.forEach((staff) => {
      if (staff.status === "ACTIVE") {
        unique.set(staff.id, staff)
      }
    })
    return Array.from(unique.values())
  }

  const openUnitSection = (unit: OperationalUnit, section: SectionType) => {
    setDetailsView({ scope: "unit", unit, section })
    setSectionSearch("")
  }

  const openProjectSection = (section: SectionType) => {
    setDetailsView({ scope: "project", section })
    setSectionSearch("")
  }

  const closeDetailsView = () => {
    setDetailsView(null)
    setSectionSearch("")
  }

  useEffect(() => {
    if (status === "loading" || !session) return
    fetchProject()
  }, [session, status, projectId])

  const fetchProject = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/projects?projectId=${projectId}`)
      if (!res.ok) throw new Error("Failed to fetch project")
      const data = await res.json()
      setProject(data[0] || null)
    } catch (err) {
      console.error("Error:", err)
      setError("Failed to load project")
    } finally {
      setLoading(false)
    }
  }

  const staffDirectory = useMemo(() => {
    if (!project?.operationalUnits) return [] as StaffDirectoryEntry[]

    const directoryMap = new Map<string, StaffDirectoryEntry>()

    const registerStaff = (staff: UnitStaff | null | undefined, unit: OperationalUnit) => {
      if (!staff || staff.status !== "ACTIVE") return

      const existing = directoryMap.get(staff.id)
      if (existing) {
        if (!existing.units.some((entryUnit) => entryUnit.id === unit.id)) {
          existing.units.push({ id: unit.id, name: unit.name, code: unit.code })
        }
        return
      }

      directoryMap.set(staff.id, {
        id: staff.id,
        name: staff.name,
        phone: staff.phone || undefined,
        role: staff.role,
        type: staff.type,
        units: [{ id: unit.id, name: unit.name, code: unit.code }],
      })
    }

    project.operationalUnits.forEach((unit) => {
      getUnitStaff(unit).forEach((staff) => registerStaff(staff, unit))
    })

    return Array.from(directoryMap.values()).map((entry) => ({
      ...entry,
      units: entry.units.sort((a, b) => a.name.localeCompare(b.name, "ar")),
    })).sort((a, b) => a.name.localeCompare(b.name, "ar"))
  }, [project])

  const summaryStats = useMemo(() => {
    if (!project) {
      return { units: 0, residents: 0, tickets: 0, staff: 0 }
    }

    const unitsCount = project.operationalUnits?.length ?? 0
    const residentsCount = project.operationalUnits?.reduce(
      (total, unit) => total + (unit.residents?.length ?? 0),
      0
    ) ?? 0
    const ticketsCount = project.operationalUnits?.reduce(
      (total, unit) => total + (unit.tickets?.length ?? 0),
      0
    ) ?? 0

    return {
      units: unitsCount,
      residents: residentsCount,
      tickets: ticketsCount,
      staff: staffDirectory.length,
    }
  }, [project, staffDirectory])

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-6 border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
          العودة
        </Button>
        <Alert className="bg-[#FEF2F2] border-[#DC2626]/20">
          <AlertCircle className="h-4 w-4 text-[#DC2626]" />
          <AlertDescription className="text-[#DC2626]">
            {error || "المشروع غير موجود"}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-4 border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
            العودة
          </Button>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">{project.name}</h1>
          <p className="text-gray-500">
            {project.type === "RESIDENTIAL_COMPOUND" && "مجمع سكني"}
            {project.type === "PHARMACY" && "صيدلية"}
            {project.type === "MALL" && "مول تجاري"}
            {project.type === "OFFICE_BUILDING" && "مبنى إداري"}
            {project.type === "RESORT" && "منتجع سياحي"}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            تاريخ الإنشاء: {new Date(project.createdAt).toLocaleDateString("ar-EG")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              onClick={() => router.push(`/dashboard/operational-units?projectId=${project.id}`)}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              إضافة وحدة
            </Button>
          )}
          {project.isActive && (
            <Badge className="bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]">
              نشط
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="border-[#E5E7EB]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">الوحدات</CardTitle>
            <Building2 className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-gray-900">{summaryStats.units}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() =>
                document.getElementById("project-units-section")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            >
              عرض الوحدات
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">السكان</CardTitle>
            <Users className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-gray-900">{summaryStats.residents}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => openProjectSection("residents")}
            >
              عرض السكان
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">التذاكر</CardTitle>
            <Ticket className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-gray-900">{summaryStats.tickets}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => openProjectSection("tickets")}
            >
              عرض التذاكر
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">فريق العمل</CardTitle>
            <HardHat className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-gray-900">{summaryStats.staff}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => openProjectSection("staff")}
            >
              عرض الفريق
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Management Fee Section - REMOVED (Now at Unit Level) */}
      {canViewFinancialDetails && (
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 mb-8 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-gray-500" />
            <h3 className="text-base font-semibold text-gray-900">رسوم الإدارة الشهرية</h3>
          </div>
          <p className="text-gray-500 text-sm mb-2">
            رسوم الإدارة الشهرية يتم تحديدها على مستوى كل <strong>وحدة تشغيلية</strong> بشكل منفصل.
          </p>
          <p className="text-gray-500 text-sm">
            لتعديل الرسوم الشهرية، قم بفتح صفحة الوحدة التشغيلية من القائمة أدناه.
          </p>
        </div>
      )}


      {/* Operational Units Section */}
      <div id="project-units-section" className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900">الوحدات التشغيلية</h2>
        </div>

        {!project.operationalUnits || project.operationalUnits.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">لا توجد وحدات تشغيلية للمشروع حالياً</p>
            {isAdmin && (
              <Button
                onClick={() => router.push(`/dashboard/operational-units?projectId=${project.id}`)}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                إضافة أول وحدة
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {project.operationalUnits.map((unit) => {
              const residentsCount = unit.residents?.length ?? 0
              const ticketsCount = unit.tickets?.length ?? 0
              const staffCount = getUnitStaff(unit).length

              return (
                <div
                  key={unit.id}
                  className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-[12px] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-gray-900 font-semibold">{unit.name}</h3>
                        <Badge variant="outline" className="bg-white border border-[#E5E7EB] text-gray-700 text-xs">
                          {unit.code}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>النوع: {unit.type}</span>
                        {canViewFinancialDetails && unit.monthlyManagementFee && (
                          <span className="text-gray-900 font-semibold">
                            {unit.monthlyManagementFee.toLocaleString()} جنيه/شهر
                          </span>
                        )}
                        {canViewFinancialDetails && unit.monthlyBillingDay && (
                          <span>يوم التحصيل: {unit.monthlyBillingDay}</span>
                        )}
                        <span className="text-gray-400">{unit.isActive ? "نشطة" : "غير نشطة"}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-emerald-600 hover:text-emerald-700"
                      onClick={() => router.push(`/dashboard/operational-units/${unit.id}`)}
                    >
                      فتح الوحدة
                      <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => openUnitSection(unit, "residents")}
                    >
                      السكان
                      <Badge variant="outline" className="text-xs">
                        {residentsCount}
                      </Badge>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => openUnitSection(unit, "tickets")}
                    >
                      التذاكر
                      <Badge variant="outline" className="text-xs">
                        {ticketsCount}
                      </Badge>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => openUnitSection(unit, "staff")}
                    >
                      الفريق
                      <Badge variant="outline" className="text-xs">
                        {staffCount}
                      </Badge>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <Dialog open={Boolean(detailsView)} onOpenChange={(open) => (open ? null : closeDetailsView())}>
        <DialogContent className="max-w-2xl">
          {detailsView && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {detailsView.scope === "project"
                    ? detailsView.section === "residents"
                      ? "سكان المشروع"
                      : detailsView.section === "tickets"
                        ? "التذاكر المرتبطة"
                        : "فريق المشروع"
                    : detailsView.section === "residents"
                      ? `سكان وحدة ${detailsView.unit.name}`
                      : detailsView.section === "tickets"
                        ? `تذاكر وحدة ${detailsView.unit.name}`
                        : `فريق وحدة ${detailsView.unit.name}`}
                </DialogTitle>
                <DialogDescription>
                  استخدم البحث للعثور بسرعة على التفاصيل المطلوبة.
                </DialogDescription>
              </DialogHeader>

              <Input
                autoFocus
                placeholder="ابحث بالاسم أو الرقم أو الكود"
                className="mt-4"
                value={sectionSearch}
                onChange={(event) => setSectionSearch(event.target.value)}
              />

              <ScrollArea className="mt-4 max-h-[420px] pr-4">
                {(() => {
                  const query = sectionSearch.trim().toLowerCase()
                  let items: Array<{ id: string; title: string; subtitle?: string; meta?: string }> = []

                  if (detailsView.section === "residents") {
                    const residents = detailsView.scope === "project"
                      ? project?.operationalUnits.flatMap((unit) =>
                          (unit.residents ?? []).map((resident) => ({
                            resident,
                            unit,
                          }))
                        ) ?? []
                      : (detailsView.unit.residents ?? []).map((resident) => ({
                          resident,
                          unit: detailsView.unit,
                        }))

                    items = residents.map(({ resident, unit }) => ({
                      id: resident.id,
                      title: resident.name,
                      subtitle:
                        resident.phone || resident.whatsappPhone || "لا يوجد رقم للتواصل",
                      meta: unit ? `${unit.code} · ${unit.name}` : undefined,
                    }))
                  } else if (detailsView.section === "tickets") {
                    const tickets = detailsView.scope === "project"
                      ? project?.operationalUnits.flatMap((unit) =>
                          (unit.tickets ?? []).map((ticket) => ({ ticket, unit }))
                        ) ?? []
                      : (detailsView.unit.tickets ?? []).map((ticket) => ({
                          ticket,
                          unit: detailsView.unit,
                        }))

                    items = tickets.map(({ ticket, unit }) => ({
                      id: ticket.id,
                      title: ticket.title,
                      subtitle: ticket.resident?.name
                        ? `${ticket.resident.name}${ticket.resident.phone ? ` • ${ticket.resident.phone}` : ""}`
                        : ticket.description || "بدون وصف",
                      meta: `${unit.code} · ${unit.name} • ${TICKET_STATUS_LABELS[ticket.status] || ticket.status}`,
                    }))
                  } else {
                    const staffEntries = detailsView.scope === "project"
                      ? staffDirectory.map((member) => ({ member }))
                      : getUnitStaff(detailsView.unit).map((staff) => ({ staff }))

                    items = staffEntries.map((entry) => {
                      if ("member" in entry) {
                        return {
                          id: entry.member.id,
                          title: entry.member.name,
                          subtitle: entry.member.phone || "لا يوجد رقم",
                          meta: `${STAFF_ROLE_LABELS[entry.member.role] || entry.member.role} • ${entry.member.units.map((unit) => unit.code).join("، ")}`,
                        }
                      }

                      return {
                        id: entry.staff.id,
                        title: entry.staff.name,
                        subtitle: entry.staff.phone || "لا يوجد رقم",
                        meta: `${STAFF_ROLE_LABELS[entry.staff.role] || entry.staff.role} • ${STAFF_TYPE_LABELS[entry.staff.type]}`,
                      }
                    })
                  }

                  const filteredItems = query
                    ? items.filter((item) =>
                        item.title.toLowerCase().includes(query) ||
                        (item.subtitle ?? "").toLowerCase().includes(query) ||
                        (item.meta ?? "").toLowerCase().includes(query)
                      )
                    : items

                  if (filteredItems.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground mt-2">
                        لا توجد نتائج مطابقة.
                      </p>
                    )
                  }

                  return (
                    <div className="space-y-3">
                      {filteredItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3"
                        >
                          <p className="font-medium text-gray-900">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-sm text-gray-500 mt-1">{item.subtitle}</p>
                          )}
                          {item.meta && (
                            <p className="text-xs text-gray-400 mt-1">{item.meta}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
