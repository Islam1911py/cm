"use client"

import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { DollarSign, TrendingUp, Calendar, AlertCircle, Loader, CheckCircle2, CreditCard, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface CombinedPayment {
  id: string
  amount: number
  paidAt: string
  type: "invoice" | "technician"
  invoiceId?: string
  invoiceNumber?: string
  unitId?: string
  unitName?: string
  projectId?: string
  projectName?: string
  technicianId?: string
  technicianName?: string
}

interface UnitContext {
  id: string
  name: string
  code: string
  type?: string
  isActive?: boolean
  monthlyManagementFee?: number
  monthlyBillingDay?: number
  project?: {
    id: string
    name: string
  }
  _count?: {
    residents: number
    tickets: number
    deliveryOrders: number
  }
}

export default function PaymentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const unitId = searchParams.get("unit")
  
  const [payments, setPayments] = useState<CombinedPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [unitContext, setUnitContext] = useState<UnitContext | null>(null)
  const [unitLoading, setUnitLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (status === "loading" || !session) return
    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      router.replace("/dashboard")
      return
    }
    fetchPayments()
  }, [status, session])

  useEffect(() => {
    if (!unitId) {
      setUnitContext(null)
      return
    }

    const fetchUnit = async () => {
      try {
        setUnitLoading(true)
        const res = await fetch(`/api/operational-units/${unitId}`)
        if (!res.ok) throw new Error("Failed to fetch unit")
        const data = await res.json()
        setUnitContext(data)
      } catch (err) {
        console.error("Error fetching unit:", err)
        setUnitContext(null)
      } finally {
        setUnitLoading(false)
      }
    }

    fetchUnit()
  }, [unitId])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch invoices
      const invoicesRes = await fetch("/api/invoices")
      const invoices = invoicesRes.ok ? await invoicesRes.json() : []
      
      // Add individual payments and paid invoices
      const invoicePayments: CombinedPayment[] = []
      invoices.forEach((inv: any) => {
        // Add individual payments
        inv.payments?.forEach((payment: any) => {
          invoicePayments.push({
            id: payment.id,
            amount: payment.amount,
            paidAt: payment.createdAt || inv.issuedAt,
            type: "invoice",
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            unitId: inv.unitId,
            unitName: inv.unit?.name,
            projectId: inv.unit?.project?.id,
            projectName: inv.unit?.project?.name
          })
        })
        
        // Also add fully paid invoices (if no individual payments recorded)
        if (inv.isPaid && inv.totalPaid > 0 && (!inv.payments || inv.payments.length === 0)) {
          invoicePayments.push({
            id: `inv-${inv.id}`,
            amount: inv.totalPaid,
            paidAt: inv.updatedAt || inv.issuedAt,
            type: "invoice",
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            unitId: inv.unitId,
            unitName: inv.unit?.name,
            projectId: inv.unit?.project?.id,
            projectName: inv.unit?.project?.name
          })
        }
      })

      // Fetch technician payments
      const techRes = await fetch("/api/technician-payments")
      const techPayments: CombinedPayment[] = []
      
      if (techRes.ok) {
        const payments = await techRes.json()
        payments.forEach((payment: any) => {
          techPayments.push({
            id: payment.id,
            amount: payment.amount,
            paidAt: payment.paidAt,
            type: "technician",
            technicianId: payment.technicianId,
            technicianName: payment.technician?.name || "Unknown",
            unitId: payment.work?.unit?.id,
            unitName: payment.work?.unit?.name,
            projectId: payment.work?.unit?.project?.id,
            projectName: payment.work?.unit?.project?.name
          })
        })
      }

      setPayments([...invoicePayments, ...techPayments])
    } catch (err) {
      console.error("Error fetching payments:", err)
      setError("فشل تحميل المدفوعات")
    } finally {
      setLoading(false)
    }
  }

  // Filter payments
  const filteredPayments = useMemo(() => {
    let filtered = payments

    if (unitId) {
      filtered = filtered.filter(p => p.unitId === unitId)
    }

    if (filterType !== "" && filterType !== "all") {
      filtered = filtered.filter(p => p.type === filterType)
    }

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.invoiceNumber?.includes(searchTerm) ||
        p.unitName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.technicianName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (dateFrom) {
      const from = new Date(dateFrom)
      filtered = filtered.filter(p => new Date(p.paidAt) >= from)
    }

    if (dateTo) {
      const to = new Date(dateTo)
      filtered = filtered.filter(p => new Date(p.paidAt) <= to)
    }

    return filtered.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())
  }, [payments, filterType, searchTerm, dateFrom, dateTo])

  // Statistics
  const stats = useMemo(() => {
    const total = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
    const invoicePayments = filteredPayments.filter(p => p.type === "invoice")
    const techPayments = filteredPayments.filter(p => p.type === "technician")
    
    return {
      total: total.toFixed(2),
      count: filteredPayments.length,
      invoiceAmount: invoicePayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
      invoiceCount: invoicePayments.length,
      techAmount: techPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2),
      techCount: techPayments.length
    }
  }, [filteredPayments])

  if (!mounted) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2 flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 rounded-md">
              <TrendingUp className="h-6 w-6 text-gray-600" />
            </div>
            المدفوعات
          </h1>
          <p className="text-gray-500">
            {unitId ? "عرض مدفوعات الوحدة المحددة" : "عرض ومتابعة جميع المدفوعات والتحويلات"}
          </p>
        </div>

        {unitId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تفاصيل الوحدة</CardTitle>
            </CardHeader>
            <CardContent>
              {unitLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader className="h-4 w-4 animate-spin" />
                  جاري تحميل بيانات الوحدة...
                </div>
              ) : unitContext ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="bg-gray-50 border-gray-200 text-gray-700">
                      {unitContext.code}
                    </Badge>
                    <span className="font-semibold text-gray-900">{unitContext.name}</span>
                    {unitContext.project?.name && (
                      <Badge variant="secondary" className="text-xs">
                        {unitContext.project.name}
                      </Badge>
                    )}
                    {unitContext.isActive !== undefined && (
                      <Badge
                        className={
                          unitContext.isActive
                            ? "bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]"
                            : "bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626]"
                        }
                        variant="outline"
                      >
                        {unitContext.isActive ? "نشطة" : "غير نشطة"}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-md border border-[#E5E7EB] p-3">
                      <p className="text-xs text-gray-500">عدد السكان</p>
                      <p className="text-lg font-semibold text-gray-900">{unitContext._count?.residents ?? 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-md border border-[#E5E7EB] p-3">
                      <p className="text-xs text-gray-500">التذاكر</p>
                      <p className="text-lg font-semibold text-gray-900">{unitContext._count?.tickets ?? 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-md border border-[#E5E7EB] p-3">
                      <p className="text-xs text-gray-500">طلبات التوصيل</p>
                      <p className="text-lg font-semibold text-gray-900">{unitContext._count?.deliveryOrders ?? 0}</p>
                    </div>
                    <div className="bg-gray-50 rounded-md border border-[#E5E7EB] p-3">
                      <p className="text-xs text-gray-500">يوم التحصيل</p>
                      <p className="text-lg font-semibold text-gray-900">{unitContext.monthlyBillingDay ?? "-"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => router.push(`/dashboard/operational-units/${unitContext.id}`)}>
                      عرض بيانات الوحدة
                    </Button>
                    <Button variant="outline" onClick={() => router.push(`/dashboard/invoices?unit=${unitContext.id}`)}>
                      فواتير الوحدة
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">تعذر تحميل بيانات الوحدة</p>
              )}
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Payments */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <CheckCircle2 className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">إجمالي المدفوعات</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.count}</p>
          </div>

          {/* Total Amount */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <DollarSign className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">المجموع</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-2">جنيه مصري</p>
          </div>

          {/* Invoice Payments */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <CreditCard className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">دفعات الفواتير</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.invoiceAmount}</p>
            <p className="text-xs text-gray-500 mt-2">{stats.invoiceCount} معاملة</p>
          </div>

          {/* Tech Payments */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">رواتب التقنيين</p>
            <p className="text-3xl font-semibold text-gray-900">{stats.techAmount}</p>
            <p className="text-xs text-gray-500 mt-2">{stats.techCount} معاملة</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">البحث والتصفية</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 block mb-2">البحث</label>
              <Input
                placeholder="ابحث برقم الفاتورة أو الوحدة أو الفني..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#2563EB]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500 block mb-2">نوع المدفوعات</label>
                <Select value={filterType || "default"} onValueChange={(value) => {
                  if (value === "default") setFilterType("all")
                  else setFilterType(value)
                }}>
                  <SelectTrigger className="bg-white border-gray-200 text-gray-900">
                    <SelectValue placeholder="جميع المدفوعات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">جميع المدفوعات</SelectItem>
                    <SelectItem value="invoice">دفعات الفواتير</SelectItem>
                    <SelectItem value="technician">رواتب التقنيين</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500 block mb-2">من التاريخ</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-white border-gray-200 text-gray-900"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500 block mb-2">إلى التاريخ</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-white border-gray-200 text-gray-900"
                />
              </div>
            </div>

            {(searchTerm || filterType !== "all" || dateFrom || dateTo) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("")
                  setFilterType("all")
                  setDateFrom("")
                  setDateTo("")
                }}
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                مسح التصفية
              </Button>
            )}
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm overflow-x-auto">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto opacity-50 mb-2 text-gray-400" />
              <p>لا توجد مدفوعات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>النوع</TableHead>
                    <TableHead>التفاصيل</TableHead>
                    <TableHead>الوحدة / الفني</TableHead>
                    <TableHead className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" /> التاريخ
                    </TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <Badge 
                          className={
                            payment.type === "invoice"
                              ? "bg-[#EFF6FF] border border-[#2563EB]/20 text-[#2563EB]"
                              : "bg-[#F3F4F6] border border-[#E5E7EB] text-[#111827]"
                          }
                          variant="outline"
                        >
                          {payment.type === "invoice" ? "فاتورة" : "راتب فني"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-gray-900">
                        {payment.type === "invoice" ? (
                          <Link 
                            href={`/dashboard/invoices/${payment.invoiceId}`}
                            className="text-[#2563EB] hover:underline cursor-pointer"
                          >
                            الفاتورة رقم: {payment.invoiceNumber}
                          </Link>
                        ) : payment.technicianId ? (
                          <Link
                            href={`/dashboard/technicians/${payment.technicianId}`}
                            className="text-[#2563EB] hover:underline cursor-pointer"
                          >
                            الفني: {payment.technicianName}
                          </Link>
                        ) : (
                          `الفني: ${payment.technicianName}`
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {payment.type === "invoice" ? (
                          <div className="text-sm">
                            <div className="text-gray-700">{payment.unitName || "-"}</div>
                            {payment.projectName && (
                              <div className="text-xs text-gray-500">{payment.projectName}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm">
                            <div className="text-gray-700">{payment.unitName || "-"}</div>
                            {payment.projectName && (
                              <div className="text-xs text-gray-500">{payment.projectName}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(payment.paidAt).toLocaleDateString('ar-EG')}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-gray-900">
                        {payment.amount.toFixed(2)} ج.م
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
