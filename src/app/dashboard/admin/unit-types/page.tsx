"use client"

import { useEffect, useState } from "react"
import { Plus, Edit2, Trash2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

interface UnitType {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export default function UnitTypesPage() {
  const { toast } = useToast()
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UnitType | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [formData, setFormData] = useState({ name: "" })

  useEffect(() => {
    fetchUnitTypes()
  }, [])

  const fetchUnitTypes = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/unit-types")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setUnitTypes(data)
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "خطأ",
        description: "فشل تحميل أنواع الوحدات",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast({
        title: "خطأ",
        description: "أدخل اسم نوع الوحدة",
        variant: "destructive",
      })
      return
    }
    try {
      const url = editingId ? `/api/unit-types/${editingId}` : "/api/unit-types"
      const method = editingId ? "PUT" : "POST"
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || "فشل الحفظ")
      }
      toast({
        title: "نجاح",
        description: editingId ? "تم تحديث نوع الوحدة" : "تم إضافة نوع الوحدة الجديد",
      })
      setDialogOpen(false)
      resetForm()
      fetchUnitTypes()
    } catch (error) {
      toast({
        title: "خطأ",
        description: (error as Error).message || "فشل حفظ نوع الوحدة",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (type: UnitType) => {
    setEditingId(type.id)
    setFormData({ name: type.name })
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleteLoading(true)
      const response = await fetch(`/api/unit-types/${deleteTarget.id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        if (response.status === 409) {
          toast({
            title: "لا يمكن الحذف",
            description: data?.error || "هذا النوع مستخدم في وحدات",
            variant: "destructive",
          })
          return
        }
        throw new Error("Failed to delete")
      }
      toast({ title: "نجاح", description: "تم حذف نوع الوحدة" })
      setDeleteTarget(null)
      fetchUnitTypes()
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل حذف نوع الوحدة",
        variant: "destructive",
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: "" })
    setEditingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">أنواع الوحدات</h1>
          <p className="text-muted-foreground mt-2">إدارة أنواع الوحدات التشغيلية (شقة، عمارة، مكتب، إلخ)</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open) }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              إضافة نوع وحدة جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل نوع الوحدة" : "إضافة نوع وحدة جديد"}</DialogTitle>
              <DialogDescription>
                {editingId ? "قم بتعديل اسم نوع الوحدة" : "أضف نوع وحدة جديد (مثل: شقة، عمارة، مكتب)"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">اسم نوع الوحدة *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: شقة، عمارة، مكتب"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                <Button type="submit">{editingId ? "تحديث" : "إضافة"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة أنواع الوحدات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : unitTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لم يتم إضافة أنواع وحدات بعد. أضف نوعًا (مثل: شقة، عمارة) ثم اختره عند تسجيل وحدة.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>{new Date(type.createdAt).toLocaleDateString("ar-EG")}</TableCell>
                    <TableCell className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(type)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(type)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت متأكد من حذف نوع الوحدة &quot;{deleteTarget?.name}&quot;؟ لا يمكن الحذف إذا كان مستخدمًا في وحدات.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-4">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading} className="bg-red-600 hover:bg-red-700">
              {deleteLoading ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
