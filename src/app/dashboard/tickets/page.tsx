"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Ticket as TicketIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MoreVertical,
  Filter
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

interface Ticket {
  id: string
  description: string
  status: "NEW" | "IN_PROGRESS" | "DONE"
  priority?: string
  category?: string | null
  source?: string | null
  resolution?: string | null
  residentResponse?: string | null
  createdAt: string
  isResidentKnown: boolean
  contactName?: string | null
  contactPhone?: string | null
  resident?: {
    name: string
    phone?: string | null
  } | null
  unit: {
    name: string
    code: string
    project?: {
      name: string | null
    } | null
  }
  assignedTo?: {
    id: string
    name: string | null
  } | null
}

export default function TicketsPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [resolution, setResolution] = useState("")
  const [residentResponse, setResidentResponse] = useState("")
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchTickets()
  }, [statusFilter])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)

      const response = await fetch(`/api/tickets?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTickets(data)
      }
    } catch (error) {
      console.error("Error fetching tickets:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tickets"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          resolution: newStatus === "DONE" ? resolution : undefined,
          residentResponse: newStatus === "DONE" ? residentResponse : undefined
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Ticket marked as ${newStatus.toLowerCase().replace("_", " ")}`
        })
        handleCloseTicket()
        fetchTickets()
      } else {
        throw new Error("Failed to update ticket")
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ticket status"
      })
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline"; icon: any }> = {
      NEW: { variant: "default", icon: AlertTriangle },
      IN_PROGRESS: { variant: "secondary", icon: Clock },
      DONE: { variant: "outline", icon: CheckCircle2 }
    }
    const { variant, icon: Icon } = variants[status] || { variant: "default", icon: AlertTriangle }
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.replace("_", " ")}
      </Badge>
    )
  }

  const getCategoryBadge = (category?: string | null) => {
    if (!category) return null
    return (
      <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
        {category}
      </Badge>
    )
  }

  const handleOpenTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setResolution(ticket.resolution || "")
    setResidentResponse(ticket.residentResponse || "")
  }

  const handleCloseTicket = () => {
    setSelectedTicket(null)
    setResolution("")
    setResidentResponse("")
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tickets</h1>
            <p className="text-muted-foreground">Manage complaints and issues</p>
          </div>
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">التذاكر</h1>
          <p className="text-muted-foreground">إدارة الشكاوى والمشاكل</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">المرشحات:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="كل الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="NEW">جديد</SelectItem>
                <SelectItem value="IN_PROGRESS">قيد التقدم</SelectItem>
                <SelectItem value="DONE">مكتمل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <div className="grid gap-4">
        {tickets.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <TicketIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">لم يتم العثور على تذاكر</p>
              <p className="text-muted-foreground">
                {statusFilter !== "all"
                  ? "حاول تعديل المرشحات الخاصة بك"
                  : "ستظهر التذاكر هنا عند قيام السكان بإرسال شكاوى عبر WhatsApp"}
              </p>
            </CardContent>
          </Card>
        ) : (
          tickets.map((ticket) => {
            const residentName = ticket.isResidentKnown && ticket.resident
              ? ticket.resident.name
              : ticket.contactName || "ساكن غير معروف"
            const residentPhone = ticket.contactPhone || ticket.resident?.phone || "غير متوفر"
            const projectName = ticket.unit.project?.name || "غير محدد"

            return (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <h3 className="font-semibold text-lg">{ticket.description}</h3>
                        {getCategoryBadge(ticket.category)}
                        {!ticket.isResidentKnown && (
                          <Badge variant="destructive" className="bg-orange-100 text-orange-700 border-orange-200">
                            ساكن جديد
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground mb-1">السكان</p>
                          <p className="font-medium">{residentName}</p>
                          <p className="text-xs text-muted-foreground">{residentPhone}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">الموقع</p>
                          <p className="font-medium">{ticket.unit.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {projectName} • {ticket.unit.code}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">المصدر</p>
                          <p className="font-medium">{ticket.source || "النظام"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-1">تاريخ الإنشاء</p>
                          <p className="font-medium">{format(new Date(ticket.createdAt), "MMM d, yyyy HH:mm")}</p>
                        </div>
                      </div>

                      {ticket.status === "DONE" && (ticket.resolution || ticket.residentResponse) && (
                        <div className="space-y-2">
                          {ticket.resolution && (
                            <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                ملاحظات داخلية:
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                {ticket.resolution}
                              </p>
                            </div>
                          )}
                          {ticket.residentResponse && (
                            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">
                                الرد المرسل للسكان:
                              </p>
                              <p className="text-sm text-green-600 dark:text-green-200">
                                {ticket.residentResponse}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(ticket.status)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenTicket(ticket)}>
                              عرض التفاصيل
                            </DropdownMenuItem>
                            {ticket.status !== "IN_PROGRESS" && ticket.status !== "DONE" && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(ticket.id, "IN_PROGRESS")}>
                                وضع علامة قيد التقدم
                              </DropdownMenuItem>
                            )}
                            {ticket.status !== "DONE" && (
                              <DropdownMenuItem onClick={() => handleOpenTicket(ticket)}>
                                وضع علامة مكتمل
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {ticket.assignedTo && ticket.assignedTo.name && (
                        <p className="text-xs text-muted-foreground">
                          مكلف بها: {ticket.assignedTo.name}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) handleCloseTicket() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل التذكرة</DialogTitle>
            <DialogDescription>
              عرض وإدارة معلومات التذكرة
            </DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">الوصف</label>
                <p className="mt-1">{selectedTicket.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">الحالة</label>
                  <div className="mt-1">{getStatusBadge(selectedTicket.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium">الفئة</label>
                  <div className="mt-1">{getCategoryBadge(selectedTicket.category)}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">السكان</p>
                  <p className="font-medium mt-1">
                    {selectedTicket.isResidentKnown && selectedTicket.resident?.name
                      ? selectedTicket.resident.name
                      : selectedTicket.contactName || "ساكن غير معروف"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTicket.contactPhone || selectedTicket.resident?.phone || "غير متوفر"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">المصدر</p>
                  <p className="font-medium mt-1">{selectedTicket.source || "النظام"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(selectedTicket.createdAt), "MMM d, yyyy HH:mm")}
                  </p>
                </div>
              </div>
              {selectedTicket.status !== "DONE" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">الحل الداخلي</label>
                    <Textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="صف كيف تم حل المشكلة..."
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">النص المرسل للسكان</label>
                    <Textarea
                      value={residentResponse}
                      onChange={(e) => setResidentResponse(e.target.value)}
                      placeholder="اكتب الرد الذي سيتم إرساله عبر واتساب..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                {selectedTicket.status !== "IN_PROGRESS" && selectedTicket.status !== "DONE" && (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedTicket.id, "IN_PROGRESS")}
                    disabled={updating}
                  >
                    وضع علامة قيد التقدم
                  </Button>
                )}
                {selectedTicket.status !== "DONE" && (
                  <Button
                    onClick={() => handleUpdateStatus(selectedTicket.id, "DONE")}
                    disabled={updating}
                  >
                    وضع علامة مكتمل
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
