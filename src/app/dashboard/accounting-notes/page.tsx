"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
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
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

interface AccountingNote {
  id: string
  description: string
  amount: number
  notes?: string
  status: "PENDING" | "CONVERTED" | "REJECTED"
  createdAt: string
  recordedAt?: string
  unit: {
    name: string
    code: string
    project: {
      name: string
      code: string
    }
  }
  project: {
    name: string
    code: string
  }
  createdByUser: {
    id: string
    name: string
    email: string
  }
  convertedToExpense?: {
    id: string
    recordedByUser: {
      id: string
      name: string
      email: string
    }
  }
}

interface Project {
  id: string
  name: string
  operationalUnits: Array<{
    id: string
    code: string
    name: string
  }>
}

export default function AccountingNotesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [notes, setNotes] = useState<AccountingNote[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [formData, setFormData] = useState({
    unitId: "",
    amount: "",
    reason: "",
    notes: ""
  })
  const [submitting, setSubmitting] = useState(false)

  // Get units for selected project
  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const unitsForProject = selectedProject?.operationalUnits || []

  useEffect(() => {
    fetchProjects()
    fetchNotes()
  }, [statusFilter])

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects")
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
    }
  }

  const fetchNotes = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.append("status", statusFilter)

      const response = await fetch(`/api/accounting-notes?${params}`)
      if (response.ok) {
        const data = await response.json()
        setNotes(data)
      }
    } catch (error) {
      console.error("Error fetching accounting notes:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load accounting notes"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch("/api/accounting-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          unitId: formData.unitId,
          description: formData.reason,
          amount: parseFloat(formData.amount),
          sourceType: "OFFICE_FUND"
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Accounting note submitted successfully"
        })
        setCreateDialogOpen(false)
        setFormData({ unitId: "", amount: "", reason: "", notes: "" })
        fetchNotes()
      } else {
        throw new Error("Failed to submit accounting note")
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit accounting note"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecordNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/accounting-notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONVERTED" })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Accounting note recorded successfully"
        })
        fetchNotes()
      } else {
        throw new Error("Failed to record accounting note")
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record accounting note"
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; icon: any }> = {
      PENDING: { variant: "secondary", icon: Clock },
      CONVERTED: { variant: "default", icon: CheckCircle2 },
      REJECTED: { variant: "destructive", icon: XCircle }
    }
    const { variant, icon: Icon } = variants[status] || { variant: "default", icon: Clock }
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    )
  }

  const role = session?.user.role as string
  const canRecord = role === "ADMIN" || role === "ACCOUNTANT"
  const canCreate = role === "ADMIN" || role === "PROJECT_MANAGER"

  if (loading && notes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Accounting Notes</h1>
            <p className="text-muted-foreground">Manage cash expense notes from project managers</p>
          </div>
          {canCreate && (
            <Button disabled>
              <Plus className="w-4 h-4 mr-2" />
              إضافة ملاحظة
            </Button>
          )}
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
          <h1 className="text-3xl font-bold">الملاحظات المحاسبية</h1>
          <p className="text-muted-foreground">إدارة ملاحظات نفقات النقد من مديري المشاريع</p>
        </div>
        {canCreate && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Accounting Note</DialogTitle>
                <DialogDescription>
                  Submit an accounting note for cash expenses
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateNote} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="projectId">Project *</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger id="projectId">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedProjectId && (
                  <div className="space-y-2">
                    <Label htmlFor="unitId">Operational Unit *</Label>
                    <Select value={formData.unitId} onValueChange={(value) => setFormData({ ...formData, unitId: value })}>
                      <SelectTrigger id="unitId">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {unitsForProject.map(unit => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (EGP) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason *</Label>
                  <Textarea
                    id="reason"
                    required
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Describe the expense..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional details..."
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCreateDialogOpen(false)
                      setSelectedProjectId("")
                      setFormData({ unitId: "", amount: "", reason: "", notes: "" })
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting || !selectedProjectId || !formData.unitId}>
                    {submitting ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      <div className="grid gap-4">
        {notes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No accounting notes found</p>
              <p className="text-muted-foreground">
                Accounting notes will appear here when project managers submit expenses
              </p>
            </CardContent>
          </Card>
        ) : (
          notes.map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <h3 className="font-semibold text-lg">{note.description}</h3>
                      {getStatusBadge(note.status)}
                    </div>
                    
                    <div className="text-2xl font-bold text-primary">
                      EGP {note.amount.toLocaleString()}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Operational Unit</p>
                        {note.unit && (
                          <>
                            <p className="font-medium">{note.unit.name}</p>
                            <p className="text-xs text-muted-foreground">{note.unit.project.name}</p>
                          </>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Submitted By</p>
                        {note.createdByUser ? (
                          <>
                            <p className="font-medium">{note.createdByUser.name}</p>
                            <p className="text-xs text-muted-foreground">{note.createdByUser.email}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Unknown</p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Date</p>
                        <p className="font-medium">{format(new Date(note.createdAt), "MMM d, yyyy")}</p>
                        {note.recordedAt && (
                          <p className="text-xs text-muted-foreground">
                            Recorded: {format(new Date(note.recordedAt), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>

                    {note.notes && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <p className="text-sm font-medium mb-1">Notes:</p>
                        <p className="text-sm text-muted-foreground">{note.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    {note.status === "PENDING" && canRecord && (
                      <Button
                        size="sm"
                        onClick={() => handleRecordNote(note.id)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Record
                      </Button>
                    )}
                    {note.convertedToExpense && note.convertedToExpense.recordedByUser && (
                      <p className="text-xs text-muted-foreground">
                        Converted by: {note.convertedToExpense.recordedByUser.name}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
