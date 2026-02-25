"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-2xl space-y-8">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Building2 className="w-12 h-12 text-primary-foreground" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Property & Facility Management
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Professional management system for residential compounds, pharmacies, malls, 
            standalone buildings, and resorts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            onClick={() => router.push("/login")}
            className="text-base px-8"
          >
            Sign In
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 text-left">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Multi-Project</h3>
            <p className="text-sm text-muted-foreground">
              Manage multiple project types including compounds, pharmacies, malls, and resorts
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Role-Based Access</h3>
            <p className="text-sm text-muted-foreground">
              Secure access control with Admin, Accountant, and Project Manager roles
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">WhatsApp Integration</h3>
            <p className="text-sm text-muted-foreground">
              Seamless integration with WhatsApp for residents to submit complaints and orders
            </p>
          </div>
        </div>
      </div>

      <footer className="mt-auto pt-8 text-center text-sm text-muted-foreground">
        <p>&copy; 2025 Property & Facility Management System</p>
      </footer>
    </div>
  )
}
