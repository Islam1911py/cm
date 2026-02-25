"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { ArrowLeft, DollarSign, Calendar, User, MapPin, Loader, AlertCircle, Download, Printer, CreditCard, Phone, Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { format } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface Payment {
  id: string
  amount: number
  createdAt?: string | null
}

interface Expense {
  id: string
  date?: string | Date
  description: string
  amount: number
  sourceType?: string
  createdAt?: string | null
}

type OwnerContactType = "PHONE" | "EMAIL"

interface OwnerAssociationContact {
  id: string
  type: OwnerContactType
  label?: string | null
  value: string
  isPrimary: boolean
}

interface InvoiceOwnerAssociation {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  contacts?: OwnerAssociationContact[]
}

interface Invoice {
  id: string
  invoiceNumber: string
  type: "MANAGEMENT_SERVICE" | "CLAIM"
  amount: number
  issuedAt: string
  totalPaid: number
  remainingBalance: number
  isPaid: boolean
  unit: {
    id: string
    name: string
    code: string
    project: {
      id: string
      name: string
    }
  }
  ownerAssociation: InvoiceOwnerAssociation | null
  payments: Payment[]
  expenses?: Expense[]
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const invoiceId = params.id as string

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (status === "loading" || !session) return

    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      router.replace("/dashboard")
      return
    }

    fetchInvoice()
  }, [session, status, invoiceId])

  const fetchInvoice = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/invoices/${invoiceId}`)

      if (res.status === 404) {
        setError("Invoice not found")
        return
      }

      if (!res.ok) {
        throw new Error("Failed to fetch invoice")
      }

      const data = await res.json()
      setInvoice(data)
    } catch (err) {
      console.error("Error:", err)
      setError("An error occurred while fetching the invoice")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenPaymentDialog = () => {
    if (!invoice) return
    setPaymentAmount(invoice.remainingBalance.toFixed(2))
    setIsPaymentDialogOpen(true)
  }

  const handleSubmitPayment = async () => {
    if (!invoice) return

    const parsedAmount = Number(paymentAmount)

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: "قيمة غير صالحة",
        description: "يرجى إدخال مبلغ صحيح للدفع",
        variant: "destructive"
      })
      return
    }

    if (parsedAmount > invoice.remainingBalance + 0.001) {
      toast({
        title: "مبلغ أكبر من المستحق",
        description: "لا يمكن دفع مبلغ يتجاوز المتبقي على الفاتورة",
        variant: "destructive"
      })
      return
    }

    try {
      setPaying(true)
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", amount: parsedAmount })
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.error || "فشل في معالجة الدفع")
      }

      const updatedInvoice = await response.json()
      setInvoice(updatedInvoice)
      setIsPaymentDialogOpen(false)
      setPaymentAmount("")
      toast({ title: "تم الدفع", description: "تم تسجيل عملية الدفع بنجاح." })
    } catch (err) {
      console.error("Payment error:", err)
      toast({
        title: "فشل الدفع",
        description: err instanceof Error ? err.message : "حدث خطأ أثناء الدفع",
        variant: "destructive"
      })
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          رجوع
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "الفاتورة غير موجودة"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleDownloadPdf = async () => {
    if (!invoice) return

    try {
      setDownloading(true)
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`)
      if (!res.ok) throw new Error("Failed to generate PDF")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)

      const safe = (value: string) =>
        value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim()

      const fileName = `${safe(invoice.unit.project.name)}-${safe(invoice.unit.name)}-${safe(invoice.invoiceNumber)}.pdf`

      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error generating PDF:", err)
      alert("حدث خطأ أثناء إنشاء ملف PDF")
    } finally {
      setDownloading(false)
    }
  }

  const invoiceTypeLabel = invoice.type === "MANAGEMENT_SERVICE" ? "فاتورة خدمات" : "فاتورة مطالبة"
  const ownerContacts = invoice.ownerAssociation?.contacts ?? []
  const primaryPhone = ownerContacts.find((contact) => contact.type === "PHONE" && contact.isPrimary)?.value
  const primaryEmail = ownerContacts.find((contact) => contact.type === "EMAIL" && contact.isPrimary)?.value
  const secondaryContacts = ownerContacts.filter((contact) => !contact.isPrimary)

  return (
    <div className="space-y-6">
      <div data-print-hide="true" className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            رجوع
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            className="gap-2"
            disabled={downloading}
          >
            {downloading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                جاري التحميل...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                تحميل PDF
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>
        {!invoice.isPaid && (
          <Button
            size="sm"
            className="gap-2 bg-green-600 hover:bg-green-700"
            onClick={handleOpenPaymentDialog}
          >
            <CreditCard className="h-4 w-4" />
            دفع الفاتورة
          </Button>
        )}
      </div>

      <div
        data-print-root="true"
        className="space-y-6 bg-white border border-gray-200 rounded-xl p-6 md:p-8 max-w-[900px] mx-auto"
        dir="rtl"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.svg"
              alt="CMDS"
              className="h-12 w-12 rounded-lg border border-gray-200 bg-white"
            />
            <div>
              <p className="text-xs text-gray-500">الجهة المُصدِرة</p>
              <p className="text-lg font-semibold text-gray-900">CMDS</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">{invoiceTypeLabel}</div>
        </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">فاتورة رقم {invoice.invoiceNumber}</h1>
              <p className="text-gray-500 mt-2">
                {invoiceTypeLabel.replace("فاتورة ", "")}
              </p>
            </div>
            <Badge className={invoice.isPaid ? "bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]" : "bg-[#FEF2F2] border border-[#DC2626]/20 text-[#DC2626]"}>
              {invoice.isPaid ? "مدفوعة" : "غير مدفوعة"}
            </Badge>
          </div>

      {/* Main Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              إجمالي الفاتورة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{invoice.amount.toFixed(2)} ج.م</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              إجمالي المدفوع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{invoice.totalPaid.toFixed(2)} ج.م</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              المتبقي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-gray-900">{invoice.remainingBalance.toFixed(2)} ج.م</div>
          </CardContent>
        </Card>
      </div>

      {/* Project & Unit Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              بيانات المشروع
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">المشروع</p>
              <p className="font-medium text-gray-900">{invoice.unit.project.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">الوحدة</p>
              <p className="font-medium text-gray-900">{invoice.unit.name}</p>
              <p className="text-xs text-gray-500">الكود: {invoice.unit.code}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              بيانات المالك
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoice.ownerAssociation ? (
              <>
                <div>
                  <p className="text-sm text-gray-500">الاسم</p>
                  <p className="font-medium text-gray-900">{invoice.ownerAssociation.name}</p>
                </div>
                {(primaryEmail || invoice.ownerAssociation.email) && (
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span>{primaryEmail || invoice.ownerAssociation.email}</span>
                  </div>
                )}
                {(primaryPhone || invoice.ownerAssociation.phone) && (
                  <div className="flex items-center gap-2 text-sm text-gray-900">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span>{primaryPhone || invoice.ownerAssociation.phone}</span>
                  </div>
                )}
                {secondaryContacts.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm text-gray-500">جهات اتصال إضافية</p>
                    <div className="space-y-1">
                      {secondaryContacts.map((contact) => (
                        <div key={contact.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-gray-900">
                            {contact.type === "PHONE" ? (
                              <Phone className="h-4 w-4 text-gray-500" />
                            ) : (
                              <Mail className="h-4 w-4 text-gray-500" />
                            )}
                            <span>{contact.value}</span>
                          </div>
                          {contact.label && (
                            <span className="text-xs text-gray-500">{contact.label}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">لا توجد بيانات لجهة المالك المرتبطة بهذه الوحدة.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Issue Date */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            تاريخ الإصدار
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-gray-900">{format(new Date(invoice.issuedAt), "dd MMMM yyyy")}</p>
        </CardContent>
      </Card>

      {/* Invoice Details Table */}
      {invoice.expenses && invoice.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تفاصيل المصاريف</CardTitle>
            <p className="text-sm text-gray-500 mt-1">تاريخ ووصف ومبلغ كل عنصر</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>المصدر</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-sm">
                        {expense.date ? format(new Date(expense.date), "dd MMM yyyy") : "-"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">{expense.description}</TableCell>
                      <TableCell className="text-sm text-gray-500">{expense.sourceType || "-"}</TableCell>
                      <TableCell className="text-right font-semibold text-gray-900">
                        {expense.amount.toLocaleString()} ج.م
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-[#F9FAFB] font-semibold">
                    <TableCell colSpan={3} className="text-right">الإجمالي:</TableCell>
                    <TableCell className="text-right text-gray-900">
                      {invoice.expenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()} ج.م
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">سجل المدفوعات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم العملية</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm">{payment.id.slice(0, 8)}...</TableCell>
                      <TableCell className="font-medium text-gray-900">{payment.amount.toFixed(2)} ج.م</TableCell>
                      <TableCell>
                        {payment.createdAt ? format(new Date(payment.createdAt), "dd MMM yyyy") : "غير متاح"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      </div>

      <Dialog
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open)
          if (!open) {
            setPaymentAmount("")
            setPaying(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>دفع الفاتورة</DialogTitle>
            <DialogDescription>
              يمكنك دفع جزء من المبلغ المستحق أو سداده بالكامل.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600">المتبقي على الفاتورة</p>
              <p className="text-2xl font-semibold text-gray-900">{invoice.remainingBalance.toFixed(2)} ج.م</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount">مبلغ الدفع (ج.م)</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min={0}
                max={invoice.remainingBalance}
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                disabled={paying}
                placeholder={`المتاح حتى ${invoice.remainingBalance.toFixed(2)} ج.م`}
              />
              <p className="text-xs text-muted-foreground">
                يمكنك إدخال مبلغ جزئي أو الضغط على زر الدفع الكامل أدناه.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPaymentAmount(invoice.remainingBalance.toFixed(2))}
                disabled={paying}
              >
                دفع كامل المبلغ
              </Button>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)} disabled={paying}>
              إلغاء
            </Button>
            <Button
              onClick={handleSubmitPayment}
              disabled={paying || !paymentAmount}
              className="bg-green-600 hover:bg-green-700"
            >
              {paying ? "جاري المعالجة..." : "تأكيد الدفع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Navigation Links (not in PDF) */}
      <div data-print-hide="true">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">التنقل السريع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push(`/dashboard/operational-units/${invoice.unit.id}`)}
                className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
              >
                تفاصيل الوحدة
              </button>
              <button
                onClick={() => router.push(`/dashboard/payments?unit=${invoice.unit.id}`)}
                className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
              >
                مدفوعات الوحدة
              </button>
              <button
                onClick={() => router.push("/dashboard/invoices")}
                className="text-sm px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] border border-[#E5E7EB] rounded-md font-medium transition-colors"
              >
                الرجوع للفواتير
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
