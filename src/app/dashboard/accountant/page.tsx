"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  DollarSign,
  FileText,
  AlertCircle,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  Bell
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface FinancialStats {
  totalMonthlyInvoices: number
  totalClaimInvoices: number
  totalPayments: number
  pendingAccountingNotes: number
  outstandingAmount: number
  totalStaffSalaries: number
}

export default function AccountantDashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dueUnitsCount, setDueUnitsCount] = useState(0)
  const [loadingDueUnits, setLoadingDueUnits] = useState(true)

  useEffect(() => {
    fetchFinancialStats()
    fetchDueUnits()
  }, [])

  const fetchFinancialStats = async () => {
    try {
      const response = await fetch("/api/accountant/stats")
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Error fetching financial stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDueUnits = async () => {
    try {
      const response = await fetch("/api/invoices/generate-monthly")
      if (response.ok) {
        const data = await response.json()
        setDueUnitsCount(data.unitsCount || 0)
      }
    } catch (error) {
      console.error("Error fetching due units:", error)
    } finally {
      setLoadingDueUnits(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">لوحة تحكم المحاسب</h1>
        <p className="text-muted-foreground">
          أهلا بعودتك، {session?.user.name}
        </p>
      </div>

      {/* Monthly Billing Alert */}
      {!loadingDueUnits && dueUnitsCount > 0 && (
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <Bell className="h-4 w-4 text-blue-400" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 font-medium">
                📅 يوجد {dueUnitsCount} وحدة مستحقة للفوترة الشهرية اليوم
              </span>
            </div>
            <Button 
              size="sm" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push("/dashboard/invoices")}
            >
              عرض وتوليد الفواتير
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Monthly Service Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">فواتير شهرية</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalMonthlyInvoices || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">إجمالي فواتير الخدمات</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Claim Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">فواتير المطالبة</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalClaimInvoices || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">مصروفات استثنائية</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المدفوعات</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.totalPayments || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">المدفوعات المستلمة</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Outstanding Amount */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">المستحق</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold text-orange-600">
                  EGP {stats?.outstandingAmount?.toLocaleString() || "0"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">انتظار التحصيل</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Staff & Accounting Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Staff Salaries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              نظرة عامة على رواتب الموظفين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <p className="text-sm font-medium">إجمالي الرواتب الشهرية</p>
                  <p className="text-xs text-muted-foreground">عبر جميع المشاريع</p>
                </div>
                <div className="text-2xl font-bold">
                  {loading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    `EGP ${stats?.totalStaffSalaries?.toLocaleString() || "0"}`
                  )}
                </div>
              </div>
              <Button className="w-full" variant="outline" asChild>
                <a href="/dashboard/staff">إدارة الموظفين</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Accounting Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              ملاحظات محاسبية قيد الانتظار
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-6 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                  {loading ? <Skeleton className="h-10 w-20 mx-auto" /> : stats?.pendingAccountingNotes || 0}
                </div>
                <p className="text-sm text-muted-foreground">ملاحظات في انتظار التسجيل</p>
              </div>
              <Button className="w-full" variant="outline" asChild>
                <a href="/dashboard/accounting-notes">مراجعة الملاحظات</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>إجراءات سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/dashboard/invoices"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">إدارة الفواتير</div>
                <div className="text-xs text-muted-foreground">إنشاء وتتبع الفواتير</div>
              </div>
            </a>
            <a
              href="/dashboard/payments"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">تسجيل المدفوعات</div>
                <div className="text-xs text-muted-foreground">معالجة المدفوعات</div>
              </div>
            </a>
            <a
              href="/dashboard/accounting-notes"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <AlertCircle className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">الملاحظات المحاسبية</div>
                <div className="text-xs text-muted-foreground">مراجعة الملاحظات القيد الانتظار</div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>النشاط المالي الأخير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">تم تهيئة لوحة التحكم</p>
                <p className="text-xs text-muted-foreground">تتبع مالي نشط</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">نظام الدفع جاهز</p>
                <p className="text-xs text-muted-foreground">جميع الوحدات المالية تعمل</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
