"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { AlertCircle, Loader, Calendar, DollarSign, MapPin, Wrench } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TechnicianProfile {
  id: string
  name: string
  email: string
  phone: string
  specialty: string
  status: string
}

interface UnitWork {
  unitId: string
  unitName: string
  projectName?: string
  totalJobs: number
  totalCost: number
  paidAmount: number
  unpaidAmount: number
}

interface WorkRecord {
  id: string
  date: string
  type: "work" | "payment"
  unit?: {
    id: string
    name: string
  }
  description?: string
  amount: number
  isPaid?: boolean
  notes?: string
}

export default function TechnicianProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const technicianId = params.id as string

  const [profile, setProfile] = useState<TechnicianProfile | null>(null)
  const [unitWork, setUnitWork] = useState<UnitWork[]>([])
  const [workHistory, setWorkHistory] = useState<WorkRecord[]>([])

  const [loading, setLoading] = useState(true)
  const [workLoading, setWorkLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (status === "loading" || !session) return

    fetchTechnicianProfile()
    fetchWorkBreakdown()
  }, [session, status, technicianId])

  const fetchTechnicianProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/technicians/${technicianId}`)
      if (!res.ok) {
        const errorData = await res.json()
        setError(errorData.error || "Failed to fetch technician details")
        return
      }
      const data = await res.json()
      setProfile(data)
      
      // Build work history from technician works and payments
      const history: WorkRecord[] = []
      
      // Add all technician works
      if (data.works && data.works.length > 0) {
        data.works.forEach((work: any) => {
          history.push({
            id: work.id,
            date: work.createdAt || new Date().toISOString(),
            type: "work",
            unit: work.unit,
            description: work.description || `Work at ${work.unit?.name}`,
            amount: work.amount || 0,
            isPaid: work.isPaid || false
          })
        })
      }
      
      // Add all technician payments
      if (data.payments && data.payments.length > 0) {
        data.payments.forEach((payment: any) => {
          history.push({
            id: payment.id,
            date: payment.paidAt || new Date().toISOString(),
            type: "payment",
            description: `Payment received`,
            amount: payment.amount || 0,
            notes: `Payment #${payment.id.slice(0, 8)}`
          })
        })
      }
      
      // Sort by date descending
      history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setWorkHistory(history)
    } catch (err) {
      console.error("Error:", err)
      setError("An error occurred while fetching technician details")
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkBreakdown = async () => {
    try {
      setWorkLoading(true)
      const res = await fetch(`/api/technicians/${technicianId}`)
      if (!res.ok) return
      const data = await res.json()
      
      // Calculate work by unit
      const unitMap = new Map<string, UnitWork>()
      
      if (data.works && data.works.length > 0) {
        data.works.forEach((work: any) => {
          const unitId = work.unitId
          if (!unitMap.has(unitId)) {
            unitMap.set(unitId, {
              unitId,
              unitName: work.unit?.name || "Unknown Unit",
              projectName: work.unit?.project?.name || "",
              totalJobs: 0,
              totalCost: 0,
              paidAmount: 0,
              unpaidAmount: 0
            })
          }
          
          const unit = unitMap.get(unitId)!
          unit.totalJobs += 1
          unit.totalCost += work.amount || 0
          
          if (work.isPaid) {
            unit.paidAmount += work.amount || 0
          } else {
            unit.unpaidAmount += work.amount || 0
          }
        })
      }
      
      setUnitWork(Array.from(unitMap.values()))
    } catch (err) {
      console.error("Error fetching work breakdown:", err)
    } finally {
      setWorkLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">ملف الفني</h1>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "لم يتم العثور على الفني"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const totalCost = unitWork.reduce((sum, uw) => sum + uw.totalCost, 0)
  const totalPaid = unitWork.reduce((sum, uw) => sum + uw.paidAmount, 0)
  const totalUnpaid = unitWork.reduce((sum, uw) => sum + uw.unpaidAmount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Wrench className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <p className="text-muted-foreground">
                {profile.specialty} • {profile.email}
              </p>
            </div>
          </div>
        </div>
        <Badge variant={profile.status === "active" ? "default" : "secondary"}>
          {profile.status === "active" ? "نشط" : "غير نشط"}
        </Badge>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">معلومات الاتصال</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
            <p className="font-medium">{profile.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">رقم الهاتف</p>
            <p className="font-medium">{profile.phone || "غير متوفر"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">التخصص</p>
            <p className="font-medium">{profile.specialty}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">الحالة</p>
            <p className="font-medium capitalize">{profile.status}</p>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي المستحقات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCost.toFixed(2)} ج.م</div>
            <p className="text-xs text-muted-foreground mt-2">
              {unitWork.reduce((sum, uw) => sum + uw.totalJobs, 0)} عمل مُنجز
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700">المدفوع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{totalPaid.toFixed(2)} ج.م</div>
            <p className="text-xs text-green-600 mt-2">
              {Math.round((totalPaid / totalCost) * 100)}% من الإجمالي
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700">المتبقي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{totalUnpaid.toFixed(2)} ج.م</div>
            <p className="text-xs text-red-600 mt-2">
              {Math.round((totalUnpaid / totalCost) * 100)}% معلق
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Work by Unit */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>الأعمال حسب الوحدة</CardTitle>
          <button
            onClick={fetchWorkBreakdown}
            className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {workLoading ? "جاري التحميل..." : "تحديث"}
          </button>
        </CardHeader>
        <CardContent>
          {unitWork.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>لا توجد سجلات أعمال لهذا الفني</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>الوحدة</TableHead>
                    <TableHead className="text-right">عدد الأعمال</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">المدفوع</TableHead>
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead className="text-right">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitWork.map((work) => (
                    <TableRow key={work.unitId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{work.unitName}</div>
                            {work.projectName && (
                              <div className="text-xs text-muted-foreground">{work.projectName}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{work.totalJobs}</TableCell>
                      <TableCell className="text-right font-bold">
                        {work.totalCost.toFixed(0)} ج.م
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-semibold">
                        {work.paidAmount.toFixed(0)} ج.م
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-semibold">
                        {work.unpaidAmount.toFixed(0)} ج.م
                      </TableCell>
                      <TableCell className="text-right">
                        {work.unpaidAmount <= 0 ? (
                          <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded border border-green-200 bg-green-50 text-green-700">
                            تم الدفع
                          </span>
                        ) : (
                          <button
                            onClick={() => router.push(`/dashboard/technician-payments?technicianId=${profile.id}&unitId=${work.unitId}`)}
                            className="text-xs px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded transition-colors font-medium"
                          >
                            تسجيل دفعة
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work History */}
      <Card>
        <CardHeader>
          <CardTitle>سجل الأعمال</CardTitle>
        </CardHeader>
        <CardContent>
          {workHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>لا يوجد سجل أعمال</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workHistory.map((work) => (
                <div
                  key={work.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow bg-white"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold">
                        {new Date(work.date).toLocaleDateString('ar-EG')}
                      </span>
                      <Badge variant={work.type === "work" ? "outline" : "default"} className="mr-2">
                        {work.type === "work" ? "عمل" : "دفعة"}
                      </Badge>
                    </div>
                    {work.unit && (
                      <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {work.unit.name}
                      </p>
                    )}
                    <p className="text-sm">{work.description || work.notes || ""}</p>
                  </div>
                  <div className="text-left mr-4">
                    <div className="font-bold text-xl">{work.amount?.toFixed(0) || "0"} ج.م</div>
                    {work.type === "work" && (
                      <Badge
                        variant={work.isPaid ? "default" : "secondary"}
                        className="mt-2"
                      >
                        {work.isPaid ? "مدفوع" : "معلق"}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Links */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">التنقل السريع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push(`/dashboard/technician-payments?technicianId=${profile.id}`)}
              className="text-sm px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded font-medium transition-colors"
            >
              عرض مدفوعات الفني
            </button>
            <button
              onClick={() => router.push("/dashboard/technicians")}
              className="text-sm px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-colors"
            >
              العودة للفنيين
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
