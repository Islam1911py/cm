"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { FileText, DollarSign, Check, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface Invoice {
  id: string
  invoiceNumber: string
  type: string
  amount: number
  totalPaid: number
  remainingBalance: number
  isPaid: boolean
  createdAt: string
  unit: {
    id: string
    name: string
    code: string
    project: {
      id: string
      name: string
    }
  }
  expenses?: Array<{
    id: string
    description: string
    amount: number
    sourceType: string
  }>
}

export default function InvoicesPage() {
  const { data: session } = useSession()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paying, setPaying] = useState(false)
  const [filter, setFilter] = useState<"all" | "open" | "paid" | "partial">("open")

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/invoices")
      if (response.ok) {
        const data = await response.json()
        setInvoices(data)
      }
    } catch (error) {
      console.error("Error fetching invoices:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!selectedInvoice) return

    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) {
      alert("أدخل مبلغاً صحيحاً")
      return
    }

    if (amount > selectedInvoice.remainingBalance) {
      alert("المبلغ أكبر من المستحق")
      return
    }

    try {
      setPaying(true)
      const response = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", amount })
      })

      if (response.ok) {
        setShowDialog(false)
        setPaymentAmount("")
        fetchInvoices()
      } else {
        const error = await response.json()
        alert(error.error || "فشل الدفع")
      }
    } catch (error) {
      console.error("Error making payment:", error)
      alert("حدث خطأ أثناء الدفع")
    } finally {
      setPaying(false)
    }
  }

  const filteredInvoices = invoices.filter(inv => {
    if (filter === "open") return inv.remainingBalance > 0
    if (filter === "partial") return inv.remainingBalance > 0 && inv.totalPaid > 0
    if (filter === "paid") return inv.isPaid
    return true
  })

  const openInvoices = invoices.filter(inv => inv.remainingBalance > 0)
  const partialInvoices = openInvoices.filter(inv => inv.totalPaid > 0)
  const totalOpen = openInvoices.reduce((sum, inv) => sum + inv.remainingBalance, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">إدارة الفواتير</h1>
        <p className="text-muted-foreground">
          عرض وإدارة جميع الفواتير
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الفواتير المفتوحة</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openInvoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">بانتظار الدفع</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">دفعات جزئية</CardTitle>
            <FileText className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partialInvoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">تم سداد جزء من المبلغ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">المستحق الكلي</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalOpen.toLocaleString()} ج.م
            </div>
            <p className="text-xs text-muted-foreground mt-1">من الفواتير المفتوحة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الفواتير المدفوعة</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.filter(inv => inv.isPaid).length}</div>
            <p className="text-xs text-muted-foreground mt-1">مكتملة ومغلقة</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={filter === "open" ? "default" : "outline"}
          onClick={() => setFilter("open")}
        >
          مفتوح
        </Button>
        <Button
          variant={filter === "partial" ? "default" : "outline"}
          onClick={() => setFilter("partial")}
        >
          دفع جزئي
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          الكل
        </Button>
        <Button
          variant={filter === "paid" ? "default" : "outline"}
          onClick={() => setFilter("paid")}
        >
          مدفوع
        </Button>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>الفواتير</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد فواتير
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الفاتورة</TableHead>
                    <TableHead>المشروع</TableHead>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{invoice.unit.project.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.unit.code}
                        </div>
                      </TableCell>
                      <TableCell>{invoice.unit.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {invoice.type === "MANAGEMENT_SERVICE"
                            ? "خدمات"
                            : "مطالبة"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {invoice.amount.toLocaleString()} ج.م
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={invoice.remainingBalance > 0 ? "text-orange-600" : "text-green-600"}>
                          {invoice.remainingBalance.toLocaleString()} ج.م
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={invoice.isPaid ? "default" : "secondary"}
                          className={invoice.isPaid ? "bg-green-600" : "bg-orange-600"}
                        >
                          {invoice.isPaid ? "مدفوع" : "مفتوح"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(invoice)
                            setPaymentAmount("")
                            setShowDialog(true)
                          }}
                        >
                          تفاصيل
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

      {/* Invoice Details Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الفاتورة</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <p className="text-sm text-muted-foreground">المشروع</p>
                  <p className="font-medium">{selectedInvoice.unit.project.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الوحدة</p>
                  <p className="font-medium">{selectedInvoice.unit.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">رقم الوحدة</p>
                  <p className="font-medium">{selectedInvoice.unit.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">نوع الفاتورة</p>
                  <p className="font-medium">
                    {selectedInvoice.type === "MANAGEMENT_SERVICE"
                      ? "فاتورة خدمات"
                      : "فاتورة مطالبة"}
                  </p>
                </div>
              </div>

              {/* Expenses Table */}
              {selectedInvoice.expenses && selectedInvoice.expenses.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">المصاريف المرتبطة</h3>
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-gray-900">
                        <TableRow>
                          <TableHead>الوصف</TableHead>
                          <TableHead className="text-right">المبلغ</TableHead>
                          <TableHead className="text-right">النوع</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedInvoice.expenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="font-medium">{expense.description}</TableCell>
                            <TableCell className="text-right font-medium">
                              {expense.amount.toLocaleString()} ج.م
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {expense.sourceType}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Amount Summary */}
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">إجمالي المبلغ</p>
                  <p className="font-semibold text-lg">
                    {selectedInvoice.amount.toLocaleString()} ج.م
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">المدفوع</p>
                  <p className="font-semibold text-lg text-green-600">
                    {(selectedInvoice.totalPaid || 0).toLocaleString()} ج.م
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">المتبقي</p>
                  <p className="font-semibold text-lg text-orange-600">
                    {selectedInvoice.remainingBalance.toLocaleString()} ج.م
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">الحالة</p>
                  <Badge
                    className={
                      selectedInvoice.isPaid ? "bg-green-600" : "bg-orange-600"
                    }
                  >
                    {selectedInvoice.isPaid ? "مدفوع" : "مفتوح"}
                  </Badge>
                </div>
              </div>

              {/* Payment Section */}
              {!selectedInvoice.isPaid && (
                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="font-semibold">دفع الفاتورة</h3>
                  <div className="space-y-2">
                    <Label htmlFor="paymentAmount">مبلغ الدفع (ج.م)</Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={selectedInvoice.remainingBalance}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`أقصى: ${selectedInvoice.remainingBalance.toLocaleString()}`}
                      disabled={paying}
                    />
                    <p className="text-xs text-muted-foreground">
                      المتبقي: {selectedInvoice.remainingBalance.toLocaleString()} ج.م
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPaymentAmount(selectedInvoice.remainingBalance.toString())}
                      disabled={paying}
                      className="flex-1"
                    >
                      دفع كامل المبلغ
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={paying}>
              إغلاق
            </Button>
            {selectedInvoice && !selectedInvoice.isPaid && (
              <Button
                onClick={handlePayment}
                disabled={paying || !paymentAmount}
                className="bg-green-600 hover:bg-green-700"
              >
                {paying ? "جاري الدفع..." : "تأكيد الدفع"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
