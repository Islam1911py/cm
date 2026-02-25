"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { AlertCircle, Loader, ChevronLeft, Edit, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ResidentData {
  id: string
  name: string
  email: string
  phone: string
  address: string
  status: "ACTIVE" | "INACTIVE" | "MOVED_OUT"
  createdAt: string
  updatedAt: string
  unit: {
    id: string
    name: string
    code: string
    project: {
      id: string
      name: string
    }
  }
}

interface Ticket {
  id: string
  title: string
  description: string
  status: string
  priority: string
  createdAt: string
}

export default function ResidentDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const residentId = params.id as string

  const [resident, setResident] = useState<ResidentData | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    fetchResidentDetails()
  }, [session, residentId])

  const fetchResidentDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch resident data
      const resRes = await fetch(`/api/residents/${residentId}`)
      if (!resRes.ok) throw new Error("Failed to fetch resident")
      const resData = await resRes.json()
      setResident(resData)

      // Fetch resident's tickets
      const ticketsRes = await fetch(`/api/tickets?residentId=${residentId}`)
      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json()
        setTickets(Array.isArray(ticketsData) ? ticketsData : [])
      }
    } catch (err) {
      console.error("Error:", err)
      setError(err instanceof Error ? err.message : "Failed to load resident")
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-500/10 border-red-500/20 text-red-400"
      case "medium":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
      case "low":
        return "bg-green-500/10 border-green-500/20 text-green-400"
      default:
        return "bg-zinc-700 border-zinc-600 text-zinc-300"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "resolved":
      case "completed":
        return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      case "in-progress":
      case "open":
        return "bg-blue-500/10 border-blue-500/20 text-blue-400"
      case "pending":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
      case "closed":
        return "bg-zinc-700 border-zinc-600 text-zinc-300"
      default:
        return "bg-zinc-700 border-zinc-600 text-zinc-300"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="h-8 w-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  if (error || !resident) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Resident not found"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">{resident.name}</h1>
            <p className="text-zinc-400 mt-1">{resident.unit.code} - {resident.unit.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList className="bg-zinc-900 border-b border-zinc-800 rounded-none w-full justify-start">
          <TabsTrigger value="info" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none">
            Information
          </TabsTrigger>
          <TabsTrigger value="tickets" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 rounded-none">
            Tickets
          </TabsTrigger>
        </TabsList>

        {/* Information Tab */}
        <TabsContent value="info" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-zinc-400">Email</p>
                  <p className="text-white font-semibold break-all">{resident.email}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Phone</p>
                  <p className="text-white font-semibold">{resident.phone || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Address</p>
                  <p className="text-white font-semibold">{resident.address || "Not provided"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Unit Information */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-white">Unit Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-zinc-400">Operational Unit</p>
                  <p className="text-white font-semibold">{resident.unit.name}</p>
                  <p className="text-sm text-zinc-400">{resident.unit.code}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Project</p>
                  <p className="text-white font-semibold">{resident.unit.project.name}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Status</p>
                  <Badge 
                    className={`mt-1 ${
                      resident.status === "ACTIVE" 
                        ? "bg-green-500/10 border-green-500/20 text-green-400"
                        : resident.status === "INACTIVE"
                        ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                    }`}
                  >
                    {resident.status === "ACTIVE" ? "نشط" 
                     : resident.status === "INACTIVE" ? "غير نشط"
                     : "انتقل"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Member Since</p>
                  <p className="text-white font-semibold">
                    {new Date(resident.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-6">
          {tickets.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-zinc-300">No tickets for this resident</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-700 hover:bg-transparent">
                      <TableHead className="text-zinc-400">Title</TableHead>
                      <TableHead className="text-zinc-400">Status</TableHead>
                      <TableHead className="text-zinc-400">Priority</TableHead>
                      <TableHead className="text-zinc-400">Created</TableHead>
                      <TableHead className="text-zinc-400">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow key={ticket.id} className="border-zinc-700 hover:bg-zinc-800/50">
                        <TableCell className="text-white">{ticket.title}</TableCell>
                        <TableCell>
                          <Badge className={`border ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`border ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                            className="text-emerald-400 hover:bg-zinc-800"
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
