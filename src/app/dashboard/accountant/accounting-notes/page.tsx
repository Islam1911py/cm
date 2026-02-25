"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select"

interface AccountingNote {
  id: string
  description: string
  amount: number
  status: string
  projectId: string
  unitId: string
  project?: { name: string }
  unit?: { name: string; code: string }
  createdAt: string
}

interface PMAdvance {
  id: string
  amount: number
  remainingAmount: number
  notes?: string
  staff?: { id: string; name: string }
}

export default function AccountingNotesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [notes, setNotes] = useState<AccountingNote[]>([])
  const [pmAdvances, setPMAdvances] = useState<PMAdvance[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNote, setSelectedNote] = useState<AccountingNote | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sourceType, setSourceType] = useState("OFFICE_FUND")
  const [selectedPMAdvance, setSelectedPMAdvance] = useState("")
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (session?.user?.role !== "ACCOUNTANT" && session?.user?.role !== "ADMIN") {
      router.push("/dashboard")
      return
    }

    fetchData()
  }, [session, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [notesRes, pmRes] = await Promise.all([
        fetch("/api/accounting-notes"),
        fetch("/api/pm-advances")
      ])

      if (notesRes.ok) {
        const notesData = await notesRes.json()
        setNotes(Array.isArray(notesData) ? notesData : notesData.notes || [])
      }

      if (pmRes.ok) {
        const pmData = await pmRes.json()
        setPMAdvances(Array.isArray(pmData) ? pmData : pmData.advances || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "خطأ",
        description: "فشل في تحميل البيانات",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRecord = async () => {
    if (!selectedNote) return

    try {
      setRecording(true)

      const payload = {
        noteId: selectedNote.id,
        sourceType,
        ...(sourceType === "PM_ADVANCE" && selectedPMAdvance && { pmAdvanceId: selectedPMAdvance })
      }

      const response = await fetch(`/api/accounting-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to record note")
      }

      const result = await response.json()

      toast({
        title: "نجح",
        description: `تم تحويل الملاحظة إلى فاتورة: ${result.invoiceNumber}`
      })

      setDialogOpen(false)
      setSelectedNote(null)
      setSourceType("OFFICE_FUND")
      setSelectedPMAdvance("")
      fetchData()
    } catch (error) {
      toast({
        title: "خطأ",
        description: error instanceof Error ? error.message : "فشل في التسجيل",
        variant: "destructive"
      })
    } finally {
      setRecording(false)
    }
  }

  const pendingNotes = notes.filter(n => n.status === "PENDING")
  const convertedNotes = notes.filter(n => n.status === "CONVERTED")

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>جاري التحميل...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">ملاحظات محاسبية</h1>
        <p className="text-gray-500">إدارة النفقات التشغيلية المعلقة</p>
      </div>

      {/* Pending Notes */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          ملاحظات معلقة ({pendingNotes.length})
        </h2>
        {pendingNotes.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            لا توجد ملاحظات معلقة
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingNotes.map(note => (
              <Card key={note.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{note.project?.name}</h3>
                      <span className="text-sm text-gray-500">- {note.unit?.name}</span>
                    </div>
                    <p className="text-gray-600 mb-2">{note.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(note.createdAt).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      {note.amount.toLocaleString("ar-EG")} ج.م
                    </p>
                    <Badge className="mt-2">معلقة</Badge>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setSelectedNote(note)
                    setDialogOpen(true)
                  }}
                  className="mt-4 w-full"
                >
                  تسجيل وتحويل لفاتورة
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Converted Notes */}
      {convertedNotes.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            ملاحظات محولة ({convertedNotes.length})
          </h2>
          <div className="grid gap-4">
            {convertedNotes.map(note => (
              <Card key={note.id} className="p-4 opacity-75">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{note.project?.name}</h3>
                      <span className="text-sm text-gray-500">- {note.unit?.name}</span>
                    </div>
                    <p className="text-gray-600 mb-2">{note.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{note.amount.toLocaleString("ar-EG")} ج.م</p>
                    <Badge variant="secondary" className="mt-2">
                      محولة
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Record Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل الملاحظة المحاسبية</DialogTitle>
            <DialogDescription>
              اختر مصدر التمويل لهذه النفقة
            </DialogDescription>
          </DialogHeader>

          {selectedNote && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">الوصف</p>
                <p className="font-semibold">{selectedNote.description}</p>
                <p className="text-sm text-gray-600 mt-2">المبلغ</p>
                <p className="text-2xl font-bold">
                  {selectedNote.amount.toLocaleString("ar-EG")} ج.م
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  مصدر التمويل
                </label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFICE_FUND">صندوق المكتب</SelectItem>
                    <SelectItem value="PM_ADVANCE">سلفة مدير المشروع</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sourceType === "PM_ADVANCE" && (
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    السلفة
                  </label>
                  <Select value={selectedPMAdvance} onValueChange={setSelectedPMAdvance}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر سلفة" />
                    </SelectTrigger>
                    <SelectContent>
                      {pmAdvances
                        .filter(pm => pm.remainingAmount >= selectedNote.amount)
                        .map(pm => (
                          <SelectItem key={pm.id} value={pm.id}>
                            {pm.staff?.name ?? "بدون اسم"} — {pm.remainingAmount.toLocaleString("ar-EG")} ج.م متبقي
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {pmAdvances.filter(pm => pm.remainingAmount >= selectedNote.amount)
                    .length === 0 && (
                    <p className="text-sm text-red-600 mt-2">
                      لا توجد سلفات بمبلغ كافي
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setDialogOpen(false)}
                  variant="outline"
                  disabled={recording}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleRecord}
                  disabled={recording || (sourceType === "PM_ADVANCE" && !selectedPMAdvance)}
                  className="flex-1"
                >
                  {recording ? "جاري التسجيل..." : "تسجيل وتحويل"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
