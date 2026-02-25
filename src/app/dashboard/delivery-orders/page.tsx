"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  Package,
  Clock,
  CheckCircle2,
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

interface DeliveryOrder {
  id: string
  orderText: string
  status: "NEW" | "IN_PROGRESS" | "DELIVERED"
  notes?: string
  createdAt: string
  resident: {
    name: string
    phone: string
    unitNumber: string
  }
  unit: {
    name: string
    code: string
    project?: {
      name: string
    }
  }
}

export default function DeliveryOrdersPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null)
  const [notes, setNotes] = useState("")
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [statusFilter])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)

      const response = await fetch(`/api/delivery-orders?${params}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      }
    } catch (error) {
      console.error("Error fetching delivery orders:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load delivery orders"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/delivery-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          notes: newStatus === "DELIVERED" ? notes : undefined
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Order marked as ${newStatus.toLowerCase().replace("_", " ")}`
        })
        setSelectedOrder(null)
        setNotes("")
        fetchOrders()
      } else {
        throw new Error("Failed to update order")
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update order status"
      })
    } finally {
      setUpdating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline"; icon: any }> = {
      NEW: { variant: "default", icon: Package },
      IN_PROGRESS: { variant: "secondary", icon: Clock },
      DELIVERED: { variant: "outline", icon: CheckCircle2 }
    }
    const { variant, icon: Icon } = variants[status] || { variant: "default", icon: Package }
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.replace("_", " ")}
      </Badge>
    )
  }

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Delivery Orders</h1>
            <p className="text-muted-foreground">Manage supermarket delivery orders</p>
          </div>
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-6 w-20" />
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
          <h1 className="text-3xl font-bold">أوامر التوصيل</h1>
          <p className="text-muted-foreground">إدارة أوامر توصيل السوبر ماركت</p>
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
                <SelectItem value="DELIVERED">تم التوصيل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="grid gap-4">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">لم يتم العثور على أوامر توصيل</p>
              <p className="text-muted-foreground">
                {statusFilter !== "all"
                  ? "حاول تعديل المرشحات الخاصة بك"
                  : "ستظهر أوامر التوصيل هنا عند قيام السكان بالإرسال عبر WhatsApp"}
              </p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <h3 className="font-semibold text-lg">{order.orderText}</h3>
                      {getStatusBadge(order.status)}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">السكان</p>
                        <p className="font-medium">{order.resident.name}</p>
                        <p className="text-xs text-muted-foreground">{order.resident.phone}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">الموقع</p>
                        <p className="font-medium">{order.unit.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.unit.project?.name} - الوحدة {order.unit.code}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">تاريخ الإنشاء</p>
                        <p className="font-medium">{format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}</p>
                      </div>
                    </div>

                    {order.status === "DELIVERED" && order.notes && (
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                          ملاحظات التوصيل:
                        </p>
                        <p className="text-sm text-green-600 dark:text-green-500">
                          {order.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                          عرض التفاصيل
                        </DropdownMenuItem>
                        {order.status !== "IN_PROGRESS" && order.status !== "DELIVERED" && (
                          <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, "IN_PROGRESS")}>
                            وضع علامة قيد التقدم
                          </DropdownMenuItem>
                        )}
                        {order.status !== "DELIVERED" && (
                          <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                            وضع علامة تم التوصيل
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل أمر التوصيل</DialogTitle>
            <DialogDescription>
              عرض وإدارة معلومات أمر التوصيل
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">تفاصيل الطلب</label>
                <p className="mt-1">{selectedOrder.orderText}</p>
              </div>
              <div>
                <label className="text-sm font-medium">الحالة</label>
                <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
              </div>
              {selectedOrder.status !== "DELIVERED" && (
                <div>
                  <label className="text-sm font-medium">ملاحظات التوصيل (اختياري)</label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أضف ملاحظات التوصيل..."
                    rows={3}
                  />
                </div>
              )}
              <div className="flex gap-2 justify-end">
                {selectedOrder.status !== "IN_PROGRESS" && selectedOrder.status !== "DELIVERED" && (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedOrder.id, "IN_PROGRESS")}
                    disabled={updating}
                  >
                    وضع علامة قيد التقدم
                  </Button>
                )}
                {selectedOrder.status !== "DELIVERED" && (
                  <Button
                    onClick={() => handleUpdateStatus(selectedOrder.id, "DELIVERED")}
                    disabled={updating}
                  >
                    وضع علامة تم التوصيل
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
