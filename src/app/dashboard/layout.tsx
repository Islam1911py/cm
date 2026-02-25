"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  LayoutDashboard,
  Ticket,
  Package,
  FileText,
  DollarSign,
  Users,
  Phone,
  Settings,
  LogOut,
  Bell,
  Menu,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

const navigationByRole = {
  ADMIN: [
    { name: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard },
    { name: "المشاريع", href: "/dashboard/projects", icon: Building2 },
    { name: "أنواع المشاريع", href: "/dashboard/admin/project-types", icon: Building2 },
    { name: "الوحدات السكنية", href: "/dashboard/operational-units", icon: Building2 },
    { name: "السكان", href: "/dashboard/residents", icon: Users },
    { name: "التذاكر", href: "/dashboard/tickets", icon: Ticket },
    { name: "أعمال التقنيين", href: "/dashboard/technician-work", icon: FileText },
    { name: "ملاحظات المحاسبة", href: "/dashboard/accounting-notes", icon: FileText },
    { name: "الفواتير", href: "/dashboard/invoices", icon: DollarSign },
    { name: "المدفوعات", href: "/dashboard/payments", icon: DollarSign },
    { name: "النفقات التشغيلية", href: "/dashboard/accountant/operational-expenses", icon: DollarSign },
    { name: "العهد المالية", href: "/dashboard/admin/pm-advances", icon: DollarSign },
    { name: "أرقام مديري المشاريع", href: "/dashboard/admin/pm-contacts", icon: Phone },
    { name: "صلاحيات مديري المشاريع", href: "/dashboard/admin/pm-permissions", icon: Users },
    { name: "الموظفون", href: "/dashboard/staff", icon: Users },
    { name: "الرواتب الشهرية", href: "/dashboard/admin/payroll", icon: DollarSign },
    { name: "سلفات الموظفين", href: "/dashboard/admin/staff-advances", icon: DollarSign },
    { name: "التقنيون", href: "/dashboard/technicians", icon: Users },
    { name: "الإعدادات", href: "/dashboard/settings", icon: Settings },
  ],
  PROJECT_MANAGER: [
    { name: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard },
    { name: "مشاريعي", href: "/dashboard/projects", icon: Building2 },
    { name: "التذاكر", href: "/dashboard/tickets", icon: Ticket },
    { name: "أعمال التقنيين", href: "/dashboard/technician-work", icon: FileText },
    { name: "النفقات التشغيلية", href: "/dashboard/manager/operational-expenses", icon: DollarSign },
    { name: "السكان", href: "/dashboard/residents", icon: Users },
  ],
  ACCOUNTANT: [
    { name: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard },
    { name: "ملاحظات المحاسبة", href: "/dashboard/accounting-notes", icon: FileText },
    { name: "الفواتير", href: "/dashboard/invoices", icon: DollarSign },
    { name: "المدفوعات", href: "/dashboard/payments", icon: DollarSign },
    { name: "النفقات التشغيلية", href: "/dashboard/accountant/operational-expenses", icon: DollarSign },
    { name: "العهد المالية", href: "/dashboard/accountant/pm-advances", icon: DollarSign },
    { name: "رواتب التقنيين", href: "/dashboard/technician-payments", icon: DollarSign },
    { name: "الرواتب الشهرية", href: "/dashboard/accountant/payroll", icon: DollarSign },
    { name: "سلفات الموظفين", href: "/dashboard/accountant/staff-advances", icon: DollarSign },
  ],
}

interface SidebarContentProps {
  userRole: string
  pathname: string
}

function SidebarContent({ userRole, pathname }: SidebarContentProps) {
  const filteredNavigation = navigationByRole[userRole as keyof typeof navigationByRole] || []

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-8 border-b border-zinc-800">
        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white">إدارة العمليات</h1>
          <p className="text-xs text-zinc-400 mt-1">
            {userRole === "ADMIN" ? "مسؤول نظام" : userRole === "PROJECT_MANAGER" ? "مدير المشروع" : "المحاسب"}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-zinc-800 p-6 space-y-3">
        <div className="px-3 py-2">
          <p className="text-xs text-zinc-500 mb-2">مسجل دخول باسم</p>
          <p className="text-sm font-medium text-white truncate">أنت</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-center gap-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const userRole = session.user.role as string
  const currentNavigation = navigationByRole[userRole as keyof typeof navigationByRole] || []

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside data-print-hide="true" className="hidden lg:flex w-72 flex-col border-l border-zinc-800 bg-zinc-950/80 backdrop-blur h-screen sticky right-0 top-0">
        <SidebarContent userRole={userRole} pathname={pathname} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header */}
        <div data-print-hide="true" className="lg:hidden border-b border-gray-200 bg-white sticky top-0 z-50">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <span className="font-semibold text-lg text-gray-900">إدارة العمليات</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                <Bell className="w-5 h-5" />
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="p-0 w-72 bg-zinc-950 border-l border-zinc-800">
                  <SidebarContent userRole={userRole} pathname={pathname} />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <header data-print-hide="true" className="hidden lg:flex items-center justify-between border-b border-gray-200 px-8 py-5 bg-white sticky top-0 z-40">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold text-gray-900">
              {currentNavigation.find(item => pathname === item.href || pathname.startsWith(`${item.href}/`))?.name || "لوحة التحكم"}
            </h2>
            <p className="text-sm text-gray-500">مرحبا، {session?.user.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
              <Bell className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {session.user.name?.split(" ").map(n => n[0]).join("") || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-gray-900">{session.user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white border-gray-200">
                <DropdownMenuLabel className="text-gray-900">حسابي</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="text-gray-900 hover:bg-gray-100">الإعدادات</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="text-red-600 hover:bg-red-50">
                  <LogOut className="mr-2 h-4 w-4" />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-background">{children}</div>
      </main>
    </div>
  )
}
