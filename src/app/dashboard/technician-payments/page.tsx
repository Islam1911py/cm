"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Technician {
  id: string
  name: string
}

interface OperationalUnit {
  id: string
  name: string
  code: string
}

interface TechnicianWork {
  id: string
  description: string
  amount: number
  isPaid: boolean
  createdAt: string
  technician: Technician
  unit: OperationalUnit
}

interface TechnicianPayment {
  id: string
  amount: number
  notes: string | null
  paidAt: string
  technician: Technician
}

export default function TechnicianPaymentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const technicianIdParam = searchParams.get("technicianId") || searchParams.get("technician")
  const unitIdParam = searchParams.get("unitId") || searchParams.get("unit")
  const { toast } = useToast()
  const [payments, setPayments] = useState<TechnicianPayment[]>([])
  const [unpaidWork, setUnpaidWork] = useState<TechnicianWork[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    technicianId: "",
    amount: "",
    notes: ""
  })

  // Redirect if not ACCOUNTANT or ADMIN
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    } else if (status === "authenticated") {
      if (session?.user?.role !== "ADMIN" && session?.user?.role !== "ACCOUNTANT") {
        router.replace("/dashboard")
      }
    }
  }, [status, session, router])

  // Fetch data
  useEffect(() => {
    if (status === "authenticated") {
      fetchPayments()
      fetchUnpaidWork()
      fetchTechnicians()
    }
  }, [status])

  useEffect(() => {
    if (technicianIdParam) {
      setFormData((prev) => ({ ...prev, technicianId: technicianIdParam }))
      setSelectedWorkIds(new Set())
      setIsCreateDialogOpen(true)
    }
  }, [technicianIdParam])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/technician-payments")
      if (!res.ok) throw new Error("Failed to fetch payments")
      const data = await res.json()
      setPayments(data)
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Failed to load technician payments",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchUnpaidWork = async () => {
    try {
      const res = await fetch("/api/technician-work?isPaid=false")
      if (!res.ok) throw new Error("Failed to fetch unpaid work")
      const data = await res.json()
      setUnpaidWork(data)
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const fetchTechnicians = async () => {
    try {
      const res = await fetch("/api/technicians")
      if (!res.ok) throw new Error("Failed to fetch technicians")
      const data = await res.json()
      setTechnicians(data)
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const handleSelectWork = (workId: string) => {
    const newSet = new Set(selectedWorkIds)
    if (newSet.has(workId)) {
      newSet.delete(workId)
    } else {
      newSet.add(workId)
    }
    setSelectedWorkIds(newSet)
  }

  const handlePaymentCreate = async () => {
    if (!formData.technicianId || selectedWorkIds.size === 0 || !formData.amount) {
      toast({
        title: "Error",
        description: "Technician, work records, and amount are required",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/technician-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: formData.technicianId,
          amount: parseFloat(formData.amount),
          notes: formData.notes || null,
          workIds: Array.from(selectedWorkIds),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create payment")
      }

      toast({
        title: "Success",
        description: "Payment recorded and work marked as paid",
      })

      setFormData({ technicianId: "", amount: "", notes: "" })
      setSelectedWorkIds(new Set())
      setIsCreateDialogOpen(false)
      fetchPayments()
      fetchUnpaidWork()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create payment",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredUnpaidWork = formData.technicianId
    ? unpaidWork.filter(work => {
        const matchesTechnician = work.technician.id === formData.technicianId
        const matchesUnit = unitIdParam ? work.unit.id === unitIdParam : true
        return matchesTechnician && matchesUnit
      })
    : []

  const totalSelectedAmount = filteredUnpaidWork
    .filter(work => selectedWorkIds.has(work.id))
    .reduce((sum, work) => sum + work.amount, 0)

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Technician Payments</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Technician Payment</DialogTitle>
              <DialogDescription>
                Select unpaid work records to process payment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label>Technician</Label>
                <Select value={formData.technicianId} onValueChange={(value) => {
                  setFormData({ ...formData, technicianId: value })
                  setSelectedWorkIds(new Set())
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.technicianId && filteredUnpaidWork.length > 0 && (
                <div>
                  <Label className="mb-3 block">Unpaid Work Records</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                    {filteredUnpaidWork.map((work) => (
                      <div key={work.id} className="flex items-start gap-3 p-2 border rounded hover:bg-accent">
                        <Checkbox
                          id={work.id}
                          checked={selectedWorkIds.has(work.id)}
                          onCheckedChange={() => handleSelectWork(work.id)}
                        />
                        <label htmlFor={work.id} className="flex-1 cursor-pointer">
                          <p className="font-medium text-sm">{work.unit.name} - ${work.amount.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">{work.description}</p>
                          <p className="text-xs text-muted-foreground">{new Date(work.createdAt).toLocaleDateString()}</p>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.technicianId && filteredUnpaidWork.length === 0 && (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded">
                  No unpaid work records for this technician.
                </p>
              )}

              <div>
                <Label>Payment Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  disabled={selectedWorkIds.size === 0}
                />
                {selectedWorkIds.size > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Total selected: ${totalSelectedAmount.toFixed(2)}
                  </p>
                )}
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Add any notes about this payment"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <Button
                onClick={handlePaymentCreate}
                disabled={submitting || selectedWorkIds.size === 0}
                className="w-full gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No technician payments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Technician</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Paid Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.technician.name}</TableCell>
                    <TableCell className="font-semibold">${payment.amount.toFixed(2)}</TableCell>
                    <TableCell className="max-w-sm truncate text-muted-foreground">
                      {payment.notes || "—"}
                    </TableCell>
                    <TableCell>{new Date(payment.paidAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
