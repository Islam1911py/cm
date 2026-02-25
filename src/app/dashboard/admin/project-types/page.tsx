"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
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

interface ProjectType {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export default function ProjectTypesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProjectType | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [forceDetails, setForceDetails] = useState<
    | null
    | {
        elementsInUse: number
        projectsInUse: number
      }
  >(null)
  const [formData, setFormData] = useState({ name: "" })

  useEffect(() => {
    fetchProjectTypes()
  }, [])

  const fetchProjectTypes = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/project-types")
      if (!response.ok) throw new Error("Failed to fetch")
      const data = await response.json()
      setProjectTypes(data)
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "خطأ",
        description: "فشل تحميل أنواع المشاريع",
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
        description: "أدخل اسم نوع المشروع",
        variant: "destructive",
      })
      return
    }

    try {
      const url = editingId ? `/api/project-types/${editingId}` : "/api/project-types"
      const method = editingId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.name }),
      })

      if (!response.ok) throw new Error("Failed to save")

      toast({
        title: "نجاح",
        description: editingId ? "تم تحديث نوع المشروع" : "تم إضافة نوع المشروع الجديد",
      })

      setDialogOpen(false)
      resetForm()
      fetchProjectTypes()
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل حفظ نوع المشروع",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (type: ProjectType) => {
    setEditingId(type.id)
    setFormData({ name: type.name })
    setDialogOpen(true)
  }

  const handleDelete = async (force?: boolean) => {
    if (!deleteTarget) return

    try {
      setDeleteLoading(true)
      const response = await fetch(
        `/api/project-types/${deleteTarget.id}${force ? "?force=true" : ""}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        if (response.status === 409) {
          const data = await response.json()
          if (data.retryWithForce) {
            setForceDetails({
              elementsInUse: data.elementsInUse ?? 0,
              projectsInUse: data.projectsInUse ?? 0,
            })
            toast({
              title: "يتطلب تأكيدًا إضافيًا",
              description: "هذا النوع مستخدم. يمكنك إعادة التعيين ثم الحذف.",
            })
            return
          }
        }
        throw new Error("Failed to delete")
      }

      toast({
        title: "نجاح",
        description: "تم حذف نوع المشروع",
      })

      closeDeleteDialog()
      fetchProjectTypes()
    } catch (error) {
      console.error("delete project type", error)
      toast({
        title: "خطأ",
        description: "فشل حذف نوع المشروع",
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

  const closeDeleteDialog = () => {
    setDeleteTarget(null)
    setForceDetails(null)
    setDeleteLoading(false)
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
    }
    setDialogOpen(open)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">أنواع المشاريع</h1>
          <p className="text-muted-foreground mt-2">
            إدارة أنواع المشاريع في النظام
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              إضافة نوع مشروع جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "تعديل نوع المشروع" : "إضافة نوع مشروع جديد"}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? "قم بتعديل معلومات نوع المشروع"
                  : "أضف نوع مشروع جديد إلى النظام"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">اسم نوع المشروع *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="مثال: سكني، صيدلية، مول"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  إلغاء
                </Button>
                <Button type="submit">
                  {editingId ? "تحديث" : "إضافة"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة أنواع المشاريع</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : projectTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لم يتم إضافة أنواع مشاريع بعد</p>
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
                {projectTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>
                      {new Date(type.createdAt).toLocaleDateString("ar-EG")}
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(type)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(type)}
                      >
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
          <AlertDialogDescription>
            {forceDetails
              ? `سيتم إعادة تعيين ${forceDetails.projectsInUse} مشروع و ${forceDetails.elementsInUse} عنصر إلى نوع بديل قبل الحذف.`
              : "هل أنت متأكد من رغبتك في حذف هذا النوع؟ هذا الإجراء لا يمكن التراجع عنه."}
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={deleteLoading}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(!!forceDetails)}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {forceDetails ? "إعادة التعيين ثم الحذف" : "حذف"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
