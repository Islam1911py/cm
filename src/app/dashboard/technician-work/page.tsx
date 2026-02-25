'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Play, CheckCircle, Trash2 } from 'lucide-react'

interface Project {
  id: string
  name: string
  operationalUnits: { id: string; code: string; name: string }[]
}

interface TechnicianWork {
  id: string
  technicianId: string
  description: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  amount: number | null
  createdAt: string
  technician: { name: string }
  unit: { name: string; code: string; project: { name: string } }
}

interface Technician {
  id: string
  name: string
}

export default function TechnicianWorkPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()

  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [work, setWork] = useState<TechnicianWork[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeWorkId, setCompleteWorkId] = useState<string | null>(null)

  const [formData, setFormData] = useState({ technicianId: '', projectId: '', unitId: '', description: '' })
  const [completeData, setCompleteData] = useState({ amount: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  // Load initial data
  useEffect(() => {
    const load = async () => {
      try {
        const pRes = await fetch('/api/projects')
        const p = await pRes.json()
        setProjects(p)

        const tRes = await fetch('/api/technicians')
        const t = await tRes.json()
        setTechnicians(t)

        const wRes = await fetch('/api/technician-work')
        const w = await wRes.json()
        setWork(w)

        setLoading(false)
      } catch (err) {
        console.error(err)
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleCreateWork = async () => {
    if (!formData.technicianId || !formData.projectId || !formData.unitId || !formData.description.trim()) {
      toast({ title: 'خطأ', description: 'ملء جميع الحقول مطلوب', variant: 'destructive' })
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch('/api/technician-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId: formData.technicianId,
          unitId: formData.unitId,
          description: formData.description,
        }),
      })

      if (!res.ok) throw new Error('Failed')

      toast({ title: 'نجاح', description: 'تم إضافة العمل' })
      setFormData({ technicianId: '', projectId: '', unitId: '', description: '' })
      setCreateOpen(false)

      const wRes = await fetch('/api/technician-work')
      const w = await wRes.json()
      setWork(w)
    } catch (err) {
      toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartWork = async (workId: string) => {
    try {
      const res = await fetch(`/api/technician-work/${workId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })

      if (!res.ok) throw new Error('Failed')

      toast({ title: 'نجاح', description: 'تم بدء العمل' })

      const wRes = await fetch('/api/technician-work')
      const w = await wRes.json()
      setWork(w)
    } catch (err) {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  const handleCompleteWork = async () => {
    if (!completeData.amount || !completeData.notes.trim() || !completeWorkId) {
      toast({ title: 'خطأ', description: 'ملء الحقول مطلوب', variant: 'destructive' })
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch(`/api/technician-work/${completeWorkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          amount: parseFloat(completeData.amount),
          description: completeData.notes,
        }),
      })

      if (!res.ok) throw new Error('Failed')

      toast({ title: 'نجاح', description: 'تم إكمال العمل وإضافة الفلوس للعامل والفاتورة' })
      setCompleteData({ amount: '', notes: '' })
      setCompleteWorkId(null)
      setCompleteOpen(false)

      const wRes = await fetch('/api/technician-work')
      const w = await wRes.json()
      setWork(w)
    } catch (err) {
      toast({ title: 'خطأ', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteWork = async (workId: string) => {
    if (!confirm('حذف هذا العمل؟')) return

    try {
      const res = await fetch(`/api/technician-work/${workId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')

      toast({ title: 'نجاح', description: 'تم الحذف' })

      const wRes = await fetch('/api/technician-work')
      const w = await wRes.json()
      setWork(w)
    } catch (err) {
      toast({ title: 'خطأ', variant: 'destructive' })
    }
  }

  if (loading) {
    return <div className="p-8">جاري التحميل...</div>
  }

  const selectedProject = projects.find(p => p.id === formData.projectId)

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">أعمال التقنيين</h1>
            <p className="text-gray-500 mt-1">{work.length} عمل مسجل</p>
          </div>

          {/* Create Dialog */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                <Plus className="w-4 h-4 ml-2" />
                إضافة عمل
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white max-w-md">
              <DialogHeader>
                <DialogTitle className="text-gray-900">عمل جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-gray-700 text-sm">العامل</Label>
                  <Select value={formData.technicianId} onValueChange={v => setFormData({ ...formData, technicianId: v })}>
                    <SelectTrigger className="bg-white border-gray-200 mt-2">
                      <SelectValue placeholder="اختر العامل..." />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-700 text-sm">المشروع</Label>
                  <Select value={formData.projectId} onValueChange={v => setFormData({ ...formData, projectId: v, unitId: '' })}>
                    <SelectTrigger className="bg-white border-gray-200 mt-2">
                      <SelectValue placeholder="اختر المشروع..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProject && (
                  <div>
                    <Label className="text-gray-700 text-sm">الوحدة</Label>
                    <Select value={formData.unitId} onValueChange={v => setFormData({ ...formData, unitId: v })}>
                      <SelectTrigger className="bg-white border-gray-200 mt-2">
                        <SelectValue placeholder="اختر الوحدة..." />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProject.operationalUnits.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.code} - {u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label className="text-gray-700 text-sm">وصف العمل</Label>
                  <Textarea
                    placeholder="ماذا سيتم عمله؟"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="bg-white border-gray-200 mt-2"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setCreateOpen(false)} variant="outline" className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50">
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleCreateWork}
                    disabled={submitting || !formData.technicianId || !formData.unitId || !formData.description.trim()}
                    className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  >
                    {submitting ? 'جاري...' : 'حفظ'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {work.length === 0 ? (
            <div className="p-8 text-center text-gray-500">لا توجد أعمال</div>
          ) : (
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow className="border-gray-200">
                  <TableHead className="text-gray-700">العامل</TableHead>
                  <TableHead className="text-gray-700">المشروع</TableHead>
                  <TableHead className="text-gray-700">الوحدة</TableHead>
                  <TableHead className="text-gray-700">الوصف</TableHead>
                  <TableHead className="text-gray-700">الحالة</TableHead>
                  <TableHead className="text-gray-700">المبلغ</TableHead>
                  <TableHead className="text-gray-700 text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {work.map(w => (
                  <TableRow key={w.id} className="border-gray-200 hover:bg-gray-50">
                    <TableCell className="text-gray-900">{w.technician.name}</TableCell>
                    <TableCell className="text-gray-500">{w.unit.project.name}</TableCell>
                      <TableCell className="text-gray-500">{w.unit.code}</TableCell>
                      <TableCell className="text-gray-500">{w.description}</TableCell>
                    <TableCell>
                      <Badge className={w.status === 'PENDING' ? 'bg-[#FFFBEB] text-[#F59E0B] border border-[#F59E0B]/20' : w.status === 'IN_PROGRESS' ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#2563EB]/20' : 'bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/20'}>
                        {w.status === 'PENDING' ? '⏳ معلق' : w.status === 'IN_PROGRESS' ? '▶️ قيد العمل' : '✓ مكتمل'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-900">
                      {w.amount ? `${w.amount.toLocaleString()} جنيه` : '-'}
                    </TableCell>
                    <TableCell className="text-center space-x-2">
                      {w.status === 'PENDING' && (
                        <Button size="sm" onClick={() => handleStartWork(w.id)} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      {w.status === 'IN_PROGRESS' && (
                        <Dialog open={completeOpen && completeWorkId === w.id} onOpenChange={open => {
                          setCompleteOpen(open)
                          if (open) setCompleteWorkId(w.id)
                        }}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-white">
                            <DialogHeader>
                              <DialogTitle className="text-gray-900">إكمال العمل</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-gray-700 text-sm">المبلغ (جنيه)</Label>
                                <Input
                                  type="number"
                                  placeholder="200"
                                  value={completeData.amount}
                                  onChange={e => setCompleteData({ ...completeData, amount: e.target.value })}
                                  className="bg-white border-gray-200 mt-2"
                                />
                              </div>
                              <div>
                                <Label className="text-gray-700 text-sm">ملاحظات العمل</Label>
                                <Textarea
                                  placeholder="تفاصيل العمل المنجز"
                                  value={completeData.notes}
                                  onChange={e => setCompleteData({ ...completeData, notes: e.target.value })}
                                  className="bg-white border-gray-200 mt-2"
                                  rows={3}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => setCompleteOpen(false)} variant="outline" className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50">
                                  إلغاء
                                </Button>
                                <Button
                                  onClick={handleCompleteWork}
                                  disabled={submitting || !completeData.amount || !completeData.notes.trim()}
                                  className="flex-1 bg-[#16A34A] hover:bg-[#15803D] text-white"
                                >
                                  {submitting ? 'جاري...' : 'إكمال'}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Button size="sm" onClick={() => handleDeleteWork(w.id)} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  )
}
