"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Plus, Edit2, Trash2, TrendingUp } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

interface WorkLog {
  id: string
  description: string
  amount: number
  workDate: string
  isPaid: boolean
  staff: {
    id: string
    name: string
    role: string
  }
  unit: {
    id: string
    code: string
    name: string
    project: {
      name: string
    }
  }
}

interface Staff {
  id: string
  name: string
  type: string
  role: string
}

interface Unit {
  id: string
  code: string
  name: string
  project: {
    name: string
  }
}

export default function FieldWorkerExpensesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [fieldWorkers, setFieldWorkers] = useState<Staff[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showUnpaid, setShowUnpaid] = useState(true)

  const [formData, setFormData] = useState({
    staffId: "",
    unitId: "",
    description: "",
    amount: "",
    workDate: new Date().toISOString().split("T")[0],
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [logsRes, staffRes, unitsRes] = await Promise.all([
        fetch("/api/staff-work-logs"),
        fetch("/api/staff?type=FIELD_WORKER"),
        fetch("/api/operational-units"),
      ])

      const [logs, staff, unitsList] = await Promise.all([
        logsRes.json(),
        staffRes.json(),
        unitsRes.json(),
      ])

      setWorkLogs(logs)
      setFieldWorkers(staff)
      setUnits(unitsList)
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.staffId || !formData.unitId || !formData.description || !formData.amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const url = editingId ? `/api/staff-work-logs/${editingId}` : "/api/staff-work-logs"
      const method = editingId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: formData.staffId,
          unitId: formData.unitId,
          description: formData.description,
          amount: parseFloat(formData.amount),
          workDate: new Date(formData.workDate).toISOString(),
        }),
      })

      if (!response.ok) throw new Error("Failed to save")

      toast({
        title: "Success",
        description: editingId ? "Work log updated" : "Work log added",
      })

      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: editingId ? "Failed to update" : "Failed to add work log",
        variant: "destructive",
      })
    }
  }

  const handleEdit = (log: WorkLog) => {
    setFormData({
      staffId: log.staff.id,
      unitId: log.unit.id,
      description: log.description,
      amount: log.amount.toString(),
      workDate: new Date(log.workDate).toISOString().split("T")[0],
    })
    setEditingId(log.id)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/staff-work-logs/${deleteId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      toast({
        title: "Success",
        description: "Work log deleted",
      })

      setDeleteId(null)
      fetchData()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Failed to delete work log",
        variant: "destructive",
      })
    }
  }

  const handleMarkPaid = async (logId: string, currentPaidStatus: boolean) => {
    try {
      const response = await fetch(`/api/staff-work-logs/${logId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: !currentPaidStatus }),
      })

      if (!response.ok) throw new Error("Failed to update")

      toast({
        title: "Success",
        description: currentPaidStatus ? "Marked as unpaid" : "Marked as paid",
      })

      fetchData()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Failed to update payment status",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      staffId: "",
      unitId: "",
      description: "",
      amount: "",
      workDate: new Date().toISOString().split("T")[0],
    })
    setEditingId(null)
  }

  const filteredLogs = workLogs.filter((log) =>
    showUnpaid ? !log.isPaid : true
  )

  const totalUnpaid = workLogs
    .filter((log) => !log.isPaid)
    .reduce((sum, log) => sum + log.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Field Worker Expenses</h1>
          <p className="text-muted-foreground mt-2">
            Record and manage daily work expenses for field workers
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Record Work
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Work Log" : "Record Field Worker Work"}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update the work log details"
                  : "Record a new work assignment and amount"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="staff">Field Worker *</Label>
                <Select
                  value={formData.staffId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, staffId: value })
                  }
                >
                  <SelectTrigger id="staff">
                    <SelectValue placeholder="Select a field worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldWorkers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.name} ({worker.role.replace(/_/g, " ")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="unit">Operational Unit *</Label>
                <Select
                  value={formData.unitId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, unitId: value })
                  }
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select a unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.code} - {unit.name} ({unit.project.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="workDate">Work Date *</Label>
                <Input
                  id="workDate"
                  type="date"
                  value={formData.workDate}
                  onChange={(e) =>
                    setFormData({ ...formData, workDate: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="description">Work Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe the work done"
                  className="min-h-24"
                />
              </div>

              <div>
                <Label htmlFor="amount">Amount (EGP) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="Enter amount"
                />
              </div>

              <Button type="submit" className="w-full">
                {editingId ? "Update" : "Record"} Work
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalUnpaid.toLocaleString("en-EG")} EGP
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {workLogs.filter((l) => !l.isPaid).length} unpaid work entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workLogs
                .filter((l) => l.isPaid)
                .reduce((sum, l) => sum + l.amount, 0)
                .toLocaleString("en-EG")}{" "}
              EGP
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {workLogs.filter((l) => l.isPaid).length} paid work entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Work Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workLogs
                .reduce((sum, l) => sum + l.amount, 0)
                .toLocaleString("en-EG")}{" "}
              EGP
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {workLogs.length} total work entries
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Work Logs
            </CardTitle>
            <Button
              size="sm"
              variant={showUnpaid ? "default" : "outline"}
              onClick={() => setShowUnpaid(!showUnpaid)}
            >
              {showUnpaid ? "Unpaid Only" : "All"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {showUnpaid ? "No unpaid work logs" : "No work logs found"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {format(new Date(log.workDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{log.staff.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {log.unit.code} - {log.unit.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.description}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.amount.toLocaleString("en-EG")} EGP
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.isPaid ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => handleMarkPaid(log.id, log.isPaid)}
                      >
                        {log.isPaid ? "Paid" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(log)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={() => setDeleteId(log.id)}
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete Work Log</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this work log? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
