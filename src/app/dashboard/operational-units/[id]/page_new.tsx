"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import { AlertCircle, Loader, Phone, MapPin, Calendar, Plus, Edit, DollarSign, Users, Wrench, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
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

interface UnitData {
  id: string
  name: string
  code: string
  type: string
  isActive: boolean
  project: {
    id: string
    name: string
  }
}

interface Resident {
  id: string
  name: string
  email: string
  phone: string
  address: string
}

interface Ticket {
  id: string
  title: string
  status: string
  priority: string
  resident: { name: string }
  assignedTo?: { name: string }
  createdAt: string
}

interface TechWork {
  id: string
  description: string
  amount: number
  paymentStatus: string
  technician: { name: string }
  createdAt: string
}

interface AccountingNote {
  id: string
  title: string
  description: string
  amount: number
  status: string
  createdAt: string
}

interface Invoice {
  id: string
  title: string
  amount: number
  status: string
  dueDate: string
}

export default function OperationalUnitDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const unitId = params.id as string

  const [unit, setUnit] = useState<UnitData | null>(null)
  const [residents, setResidents] = useState<Resident[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [techWork, setTechWork] = useState<TechWork[]>([])
  const [expenses, setExpenses] = useState<AccountingNote[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isPM = session?.user?.role === "PROJECT_MANAGER"
  const isAccountant = session?.user?.role === "ACCOUNTANT"
  const isAdmin = session?.user?.role === "ADMIN"

  useEffect(() => {
    if (status === "loading" || !session) return
    fetchUnitData()
  }, [session, status, unitId])

  const fetchUnitData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/summary/unit/${unitId}`)
      if (!res.ok) throw new Error("Failed to fetch unit")
      const data = await res.json()
      setUnit(data.unit)

      // Fetch related data
      Promise.all([
        fetch(`/api/operational-units/${unitId}/residents`).then(r => r.ok ? r.json() : []),
        fetch(`/api/tickets?unitId=${unitId}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/technician-work?unitId=${unitId}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/accounting-notes?unitId=${unitId}`).then(r => r.ok ? r.json() : []),
        fetch(`/api/invoices?unitId=${unitId}`).then(r => r.ok ? r.json() : []),
      ]).then(([residents, tickets, work, notes, invoices]) => {
        setResidents(residents)
        setTickets(tickets)
        setTechWork(work)
        setExpenses(notes)
        setInvoices(invoices)
      })
    } catch (err) {
      console.error("Error:", err)
      setError("Failed to load unit details")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !unit) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Unit not found"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold">{unit.name}</h1>
          <div className="flex items-center gap-3 mt-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{unit.project.name}</span>
            <span>•</span>
            <span className="text-sm">{unit.code}</span>
          </div>
        </div>
        <Badge variant={unit.isActive ? "default" : "secondary"}>
          {unit.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Residents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{residents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Open Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {tickets.filter(t => t.status !== "done").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pending Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {expenses.filter(e => e.status !== "recorded").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="residents">Residents</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="technician">Tech Work</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          {(isAccountant || isAdmin) && (
            <>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Operations Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Operations Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Total Residents</span>
                  <span className="text-2xl font-bold">{residents.length}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Tickets</span>
                  <span className="text-2xl font-bold">{tickets.length}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Technician Work Records</span>
                  <span className="text-2xl font-bold">{techWork.length}</span>
                </div>
                {isPM && (
                  <Button onClick={() => router.push(`/dashboard/operational-units/${unitId}?tab=residents`)} className="w-full mt-4">
                    View Details
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Total Expenses</span>
                  <span className="text-2xl font-bold text-yellow-600">
                    ${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Invoices</span>
                  <span className="text-2xl font-bold">{invoices.length}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="text-muted-foreground">Pending Expenses</span>
                  <span className="text-2xl font-bold text-red-600">
                    {expenses.filter(e => e.status !== "recorded").length}
                  </span>
                </div>
                {(isAccountant || isAdmin) && (
                  <Button onClick={() => router.push(`/dashboard/operational-units/${unitId}?tab=invoices`)} className="w-full mt-4">
                    View Financials
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Residents Tab */}
        <TabsContent value="residents" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Residents</h3>
            {isPM && (
              <Button onClick={() => router.push(`/dashboard/residents/new?unitId=${unitId}`)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                Add Resident
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="pt-6">
              {residents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No residents in this unit</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Address</TableHead>
                        {isPM && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {residents.map((resident) => (
                        <TableRow key={resident.id}>
                          <TableCell className="font-medium">{resident.name}</TableCell>
                          <TableCell>{resident.email || "-"}</TableCell>
                          <TableCell>{resident.phone || "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{resident.address || "-"}</TableCell>
                          {isPM && (
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/residents/${resident.id}/edit`)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Tickets</h3>
            {isPM && (
              <Button onClick={() => router.push(`/dashboard/tickets/new?unitId=${unitId}`)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                Add Ticket
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="pt-6">
              {tickets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No tickets in this unit</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Resident</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Created</TableHead>
                        {isPM && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.title}</TableCell>
                          <TableCell>{ticket.resident.name}</TableCell>
                          <TableCell>
                            <Badge variant={ticket.status === "done" ? "default" : "secondary"}>
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ticket.priority === "high" ? "destructive" : "outline"}>
                              {ticket.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>{ticket.assignedTo?.name || "-"}</TableCell>
                          <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
                          {isPM && (
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/tickets/${ticket.id}/edit`)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technician Work Tab */}
        <TabsContent value="technician" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Technician Work</h3>
            {isPM && (
              <Button onClick={() => router.push(`/dashboard/technician-work/new?unitId=${unitId}`)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                Record Work
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="pt-6">
              {techWork.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No technician work recorded</p>
              ) : (
                <div className="space-y-3">
                  {techWork.map((work) => (
                    <div key={work.id} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{work.description}</p>
                          <p className="text-sm text-muted-foreground">{work.technician.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(work.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${work.amount.toFixed(2)}</p>
                          <Badge variant={work.paymentStatus === "paid" ? "default" : "secondary"}>
                            {work.paymentStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Expenses</h3>
            {isPM && (
              <Button onClick={() => router.push(`/dashboard/accounting-notes/new?unitId=${unitId}&type=expense`)} className="gap-2" size="sm">
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="pt-6">
              {expenses.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No expenses recorded</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        {(isPM || isAdmin) && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell className="font-medium">{expense.title}</TableCell>
                          <TableCell>${expense.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={expense.status === "recorded" ? "default" : "secondary"}>
                              {expense.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(expense.createdAt).toLocaleDateString()}</TableCell>
                          {(isPM || isAdmin) && (
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/accounting-notes/${expense.id}/edit`)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        {(isAccountant || isAdmin) && (
          <TabsContent value="invoices" className="space-y-4">
            <h3 className="text-lg font-semibold">Invoices</h3>
            <Card>
              <CardContent className="pt-6">
                {invoices.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No invoices</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.title}</TableCell>
                            <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>
                                {invoice.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{invoice.dueDate || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Payments Tab */}
        {(isAccountant || isAdmin) && (
          <TabsContent value="payments" className="space-y-4">
            <h3 className="text-lg font-semibold">Payments</h3>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center py-8">Payment history</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
