"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { AlertCircle, Loader, ChevronLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

interface Project {
  id: string
  name: string
  operationalUnits: Array<{
    id: string
    name: string
    code: string
  }>
}

interface UnitContext {
  id: string
  name: string
  code: string
  project: {
    id: string
    name: string
  }
}

export default function NewResidentPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const unitIdFromQuery = searchParams.get("unitId")

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [unitContext, setUnitContext] = useState<UnitContext | null>(null)
  const [unitLoading, setUnitLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    unitId: unitIdFromQuery || "",
  })

  const [selectedProjectId, setSelectedProjectId] = useState<string>("")

  useEffect(() => {
    if (!session) return
    fetchProjects()
  }, [session])

  useEffect(() => {
    if (!unitIdFromQuery) return

    const fetchUnit = async () => {
      try {
        setUnitLoading(true)
        const res = await fetch(`/api/operational-units/${unitIdFromQuery}`)
        if (!res.ok) throw new Error("Failed to fetch unit")
        const data = await res.json()
        setUnitContext(data)
        setSelectedProjectId(data.project?.id || "")
        setFormData((prev) => ({ ...prev, unitId: data.id }))
      } catch (err) {
        console.error("Error fetching unit:", err)
        setUnitContext(null)
      } finally {
        setUnitLoading(false)
      }
    }

    fetchUnit()
  }, [unitIdFromQuery])

  useEffect(() => {
    if (!unitIdFromQuery || projects.length === 0) return

    const matchedProject = projects.find((project) =>
      project.operationalUnits.some((unit) => unit.id === unitIdFromQuery)
    )

    if (matchedProject) {
      setSelectedProjectId(matchedProject.id)
      setFormData((prev) => ({ ...prev, unitId: unitIdFromQuery }))
    }
  }, [unitIdFromQuery, projects])

  useEffect(() => {
    if (!selectedProjectId) return
    const project = projects.find((p) => p.id === selectedProjectId)
    const hasUnit = project?.operationalUnits.some((u) => u.id === formData.unitId)
    if (!hasUnit && formData.unitId) {
      setFormData((prev) => ({ ...prev, unitId: "" }))
    }
  }, [selectedProjectId, projects, formData.unitId])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to fetch projects")
      const data = await res.json()
      setProjects(data)
    } catch (err) {
      console.error("Error:", err)
      setError("Failed to load projects")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.unitId) {
      alert("Please fill in all required fields")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          unitId: formData.unitId,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to create resident")
      }

      router.push("/dashboard/residents")
    } catch (err) {
      console.error("Error:", err)
      alert(err instanceof Error ? err.message : "Failed to create resident")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedUnits = unitContext
    ? [{ id: unitContext.id, name: unitContext.name, code: unitContext.code }]
    : selectedProjectId
      ? projects.find((p) => p.id === selectedProjectId)?.operationalUnits || []
      : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="h-8 w-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-white">Add New Resident</h1>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">
                Full Name *
              </Label>
              <Input
                id="name"
                placeholder="Enter resident name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-white">
                Phone Number
              </Label>
              <Input
                id="phone"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="address" className="text-white">
                Address
              </Label>
              <Textarea
                id="address"
                placeholder="Enter address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Project Selection */}
            <div className="space-y-2">
              <Label htmlFor="project" className="text-white">
                Project *
              </Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white" disabled={!!unitIdFromQuery}>
                  <SelectValue placeholder={unitLoading ? "Loading..." : "Select a project"} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="text-white">
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unit Selection */}
            <div className="space-y-2">
              <Label htmlFor="unit" className="text-white">
                Operational Unit *
              </Label>
              <Select value={formData.unitId} onValueChange={(value) =>
                setFormData({ ...formData, unitId: value })
              }>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white" disabled={!!unitIdFromQuery}>
                  <SelectValue placeholder={unitLoading ? "Loading..." : "Select a unit"} />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {selectedUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id} className="text-white">
                      {unit.code} - {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? "Creating..." : "Create Resident"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
