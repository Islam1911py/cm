"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Building2,
  Users,
  Ticket,
  Package,
  FileText,
  DollarSign,
  AlertCircle,
  HardHat
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardStats {
  projects: number
  operationalUnits: number
  residents: number
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
  invoices: number
  payments: number
  pendingAccountingNotes: number
  staff: {
    total: number
    active: number
  }
}

export default function AdminDashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
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



  return (
    <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">لوحة التحكم الإدارية</h1>
            <p className="text-gray-500">إدارة شاملة للنظام والعمليات</p>
          </div>
        </div>

        {/* Stats Grid - Modern Card Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Projects Stat */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full">نشط</span>
            </div>
            <p className="text-gray-500 text-sm mb-1">المشاريع</p>
            {loading ? (
              <div className="h-9 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-semibold text-gray-900">{stats?.projects || 0}</p>
            )}
          </div>

          {/* Operational Units Stat */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">الوحدات التشغيلية</p>
            {loading ? (
              <div className="h-9 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-semibold text-gray-900">{stats?.operationalUnits || 0}</p>
            )}
          </div>

          {/* Residents Stat */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">السكان</p>
            {loading ? (
              <div className="h-9 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-semibold text-gray-900">{stats?.residents || 0}</p>
            )}
          </div>

          {/* Active Staff Stat */}
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <HardHat className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">الموظفون النشطون</p>
            {loading ? (
              <div className="h-9 w-16 bg-gray-200 rounded animate-pulse" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-semibold text-gray-900">{stats?.staff.active || 0}</p>
                <p className="text-sm text-gray-500">من {stats?.staff.total || 0}</p>
              </div>
            )}
          </div>
        </div>

        {/* Two Column Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tickets Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gray-100 rounded-md">
              <Ticket className="w-5 h-5 text-gray-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">نظرة عامة على التذاكر</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 border border-[#E5E7EB] rounded-[12px]">
              <p className="text-gray-500 text-sm mb-2">جديد</p>
              <div className="text-2xl font-semibold text-gray-900">
                {loading ? <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" /> : stats?.tickets.new || 0}
              </div>
            </div>
            <div className="p-4 bg-gray-50 border border-[#E5E7EB] rounded-[12px]">
              <p className="text-gray-500 text-sm mb-2">قيد التقدم</p>
              <div className="text-2xl font-semibold text-gray-900">
                {loading ? <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" /> : stats?.tickets.inProgress || 0}
              </div>
            </div>
            <div className="p-4 bg-gray-50 border border-[#E5E7EB] rounded-[12px]">
              <p className="text-gray-500 text-sm mb-2">مكتمل</p>
              <div className="text-2xl font-semibold text-gray-900">
                {loading ? <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" /> : stats?.tickets.done || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Orders Card */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gray-100 rounded-md">
              <Package className="w-5 h-5 text-gray-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">أوامر التوصيل</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 border border-[#E5E7EB] rounded-[12px]">
              <p className="text-gray-500 text-sm mb-2">جديد</p>
              <div className="text-2xl font-semibold text-gray-900">
                {loading ? <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" /> : stats?.deliveryOrders.new || 0}
              </div>
            </div>
            <div className="p-4 bg-gray-50 border border-[#E5E7EB] rounded-[12px]">
              <p className="text-gray-500 text-sm mb-2">قيد التقدم</p>
              <div className="text-2xl font-semibold text-gray-900">
                {loading ? <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" /> : stats?.deliveryOrders.inProgress || 0}
              </div>
            </div>
            <div className="p-4 bg-gray-50 border border-[#E5E7EB] rounded-[12px]">
              <p className="text-gray-500 text-sm mb-2">مسلم</p>
              <div className="text-2xl font-semibold text-gray-900">
                {loading ? <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" /> : stats?.deliveryOrders.delivered || 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial & Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Invoices */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 bg-gray-100 rounded-md">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-1">إجمالي الفواتير</p>
          <div className="text-3xl font-semibold text-gray-900">
            {loading ? <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" /> : stats?.invoices || 0}
          </div>
        </div>

        {/* Payments */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 bg-gray-100 rounded-md">
              <DollarSign className="w-5 h-5 text-gray-600" />
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-1">إجمالي المدفوعات</p>
          <div className="text-3xl font-semibold text-gray-900">
            {loading ? <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" /> : stats?.payments || 0}
          </div>
        </div>

        {/* Pending Accounting Notes */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 bg-gray-100 rounded-md">
              <AlertCircle className="w-5 h-5 text-gray-600" />
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-1">ملاحظات قيد الانتظار</p>
          <div className="text-3xl font-semibold text-gray-900">
            {loading ? <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" /> : stats?.pendingAccountingNotes || 0}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4">الوصول السريع</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/dashboard/projects"
            className="flex items-center gap-3 p-4 rounded-[12px] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors"
          >
            <div className="p-2.5 bg-gray-100 rounded-md">
              <Building2 className="w-5 h-5 text-gray-600" />
            </div>
            <span className="font-medium text-gray-900">المشاريع</span>
          </a>
          <a
            href="/dashboard/tickets"
            className="flex items-center gap-3 p-4 rounded-[12px] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors"
          >
            <div className="p-2.5 bg-gray-100 rounded-md">
              <Ticket className="w-5 h-5 text-gray-600" />
            </div>
            <span className="font-medium text-gray-900">التذاكر</span>
            </a>
            <a
              href="/dashboard/invoices"
              className="flex items-center gap-3 p-4 rounded-[12px] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors"
            >
              <FileText className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">الفواتير</span>
          </a>
          <a
            href="/dashboard/staff"
            className="flex items-center gap-3 p-4 rounded-[12px] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors"
          >
            <div className="p-2.5 bg-gray-100 rounded-md">
              <HardHat className="w-5 h-5 text-gray-600" />
            </div>
            <span className="font-medium text-gray-900">الموظفون</span>
          </a>
        </div>
      </div>
      </div>
    </div>
  )
}
