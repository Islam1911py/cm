"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { TrendingDown, Users, Loader, AlertCircle, Plus, Trash2, Pencil } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface StaffAdvance {
  id: string
  staffId: string
  staff: {
    name: string
  }
  amount: number
  date: string
  status: "PENDING" | "DEDUCTED"
  note?: string
}

interface StaffMember {
  id: string
  name: string
  salary: number
}

export default function StaffAdvancesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [advances, setAdvances] = useState<StaffAdvance[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null)
  const [staffId, setStaffId] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")

  const resetForm = () => {
    setStaffId("")
    setAmount("")
    setNote("")
    setEditingAdvanceId(null)
  }

  useEffect(() => {
    if (status === "loading" || !session) return

    if (session.user.role !== "ADMIN" && session.user.role !== "ACCOUNTANT") {
      router.replace("/dashboard")
      return
    }

    Promise.all([fetchAdvances(), fetchStaff()])
  }, [status, session])

  const fetchAdvances = async () => {
    try {
      const res = await fetch("/api/staff/advances")
      if (res.ok) {
        const data = await res.json()
        setAdvances(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Error fetching advances:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/staff")
      if (res.ok) {
        const data = await res.json()
        setStaff(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Error fetching staff:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffId || !amount) return

    try {
      setIsCreating(true)
      const parsedAmount = parseFloat(amount)
      if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setIsCreating(false)
        return
      }

      const url = editingAdvanceId
        ? `/api/staff/advances/${editingAdvanceId}`
        : "/api/staff/advances"

      const method = editingAdvanceId ? "PATCH" : "POST"

      const body = editingAdvanceId
        ? JSON.stringify({
            amount: parsedAmount,
            note
          })
        : JSON.stringify({
            staffId,
            amount: parsedAmount,
            note
          })

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body
      })

      if (res.ok) {
        resetForm()
        setIsDialogOpen(false)
        fetchAdvances()
      }
    } catch (error) {
      console.error("Error saving advance:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditAdvance = (advance: StaffAdvance) => {
    setEditingAdvanceId(advance.id)
    setStaffId(advance.staffId)
    setAmount(advance.amount.toString())
    setNote(advance.note || "")
    setIsDialogOpen(true)
  }

  const handleDeleteAdvance = async (advanceId: string) => {
    if (!confirm("هل تريد حذف هذه السلفة؟")) return

    try {
      const res = await fetch(`/api/staff/advances/${advanceId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        fetchAdvances()
      }
    } catch (error) {
      console.error("Error deleting advance:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  const pendingAdvances = advances.filter(a => a.status === "PENDING")
  const totalPending = pendingAdvances.reduce((sum, a) => sum + a.amount, 0)
  const deductedAdvances = advances.filter(a => a.status === "DEDUCTED")
  const totalDeducted = deductedAdvances.reduce((sum, a) => sum + a.amount, 0)

  return (
    <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2 flex items-center gap-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <TrendingDown className="h-6 w-6 text-gray-600" />
              </div>
              سلفات الموظفين
            </h1>
            <p className="text-gray-500">تتبع ودارة السلفات والقروض</p>
          </div>

          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) {
                resetForm()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white gap-2"
                onClick={() => {
                  resetForm()
                }}
              >
                <Plus className="h-4 w-4" />
                سلفة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle className="text-gray-900">
                  {editingAdvanceId ? "تعديل السلفة" : "إضافة سلفة جديدة"}
                </DialogTitle>
                <DialogDescription className="text-gray-500">
                  {editingAdvanceId ? "عدل بيانات السلفة المعلقة" : "حدد الموظف والمبلغ"}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-gray-500">الموظف</Label>
                  {editingAdvanceId ? (
                    <div className="bg-gray-50 border border-gray-200 text-gray-900 font-semibold rounded-md px-3 py-2 mt-2">
                      {staff.find((s) => s.id === staffId)?.name || "-"}
                    </div>
                  ) : (
                    <Select value={staffId} onValueChange={setStaffId}>
                      <SelectTrigger className="bg-white border-gray-200 text-gray-900 mt-2">
                        <SelectValue placeholder="اختر موظفاً" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.salary ? `(${s.salary.toFixed(2)})` : "(بدون راتب أساسي)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label className="text-gray-500">المبلغ</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="المبلغ"
                    className="bg-white border-gray-200 text-gray-900 mt-2"
                  />
                </div>

                <div>
                  <Label className="text-gray-500">ملاحظة</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="سبب السلفة أو ملاحظات أخرى"
                    className="bg-white border-gray-200 text-gray-900 mt-2"
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating || !staffId || !amount}
                    className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  >
                    {isCreating
                      ? editingAdvanceId
                        ? "جاري الحفظ..."
                        : "جاري الإضافة..."
                      : editingAdvanceId
                        ? "حفظ التعديلات"
                        : "إضافة"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <AlertCircle className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">السلفات المعلقة</p>
            <p className="text-3xl font-semibold text-gray-900">{totalPending.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">{pendingAdvances.length} سلفة</p>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gray-100 rounded-md">
                <TrendingDown className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mb-1">السلفات المخصومة</p>
            <p className="text-3xl font-semibold text-gray-900">{totalDeducted.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">{deductedAdvances.length} سلفة</p>
          </div>
        </div>

        {/* Advances Table */}
        <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">السلفات</h2>

          {advances.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="h-12 w-12 mx-auto opacity-50 mb-2 text-gray-400" />
              <p>لا توجد سلفات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الموظف</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الملاحظات</TableHead>
                    <TableHead className="text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.map((advance) => (
                    <TableRow key={advance.id}>
                      <TableCell className="text-gray-900 font-semibold">
                        {advance.staff.name}
                      </TableCell>
                      <TableCell className="text-right text-gray-900 font-semibold">
                        {advance.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-gray-500">
                        {new Date(advance.date).toLocaleDateString("ar-EG")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          className={
                            advance.status === "DEDUCTED"
                              ? "bg-[#ECFDF5] border border-[#16A34A]/20 text-[#16A34A]"
                              : "bg-[#FFFBEB] border border-[#F59E0B]/20 text-[#F59E0B]"
                          }
                          variant="outline"
                        >
                          {advance.status === "DEDUCTED" ? "مخصومة" : "معلقة"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-gray-500 text-sm">
                        {advance.note || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {advance.status === "PENDING" && (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditAdvance(advance)}
                              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteAdvance(advance.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
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
