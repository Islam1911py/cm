import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// Define which routes are protected and which roles can access them
const protectedRoutes = {
  "/dashboard": ["ADMIN", "ACCOUNTANT", "PROJECT_MANAGER"],
  "/dashboard/admin": ["ADMIN"],
  "/dashboard/projects": ["ADMIN", "PROJECT_MANAGER"],
  "/dashboard/operational-units": ["ADMIN"],
  "/dashboard/residents": ["ADMIN", "PROJECT_MANAGER"],
  "/dashboard/tickets": ["ADMIN", "PROJECT_MANAGER"],
  "/dashboard/delivery-orders": ["ADMIN", "PROJECT_MANAGER"],
  "/dashboard/invoices": ["ADMIN", "ACCOUNTANT"],
  "/dashboard/payments": ["ADMIN", "ACCOUNTANT"],
  "/dashboard/accounting-notes": ["ADMIN", "ACCOUNTANT", "PROJECT_MANAGER"],
  "/dashboard/staff": ["ADMIN", "ACCOUNTANT"],
  "/dashboard/reports": ["ADMIN"],
  "/dashboard/settings": ["ADMIN"]
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Check if the path starts with /dashboard
    if (path.startsWith("/dashboard")) {
      // Find the most specific matching route
      let matchedRoute: string | null = null
      const pathSegments = path.split("/")
      
      // Check from most specific to least specific
      for (let i = pathSegments.length; i >= 2; i--) {
        const routePath = pathSegments.slice(0, i).join("/")
        if (protectedRoutes[routePath]) {
          matchedRoute = routePath
          break
        }
      }

      // Default to /dashboard if no specific route matched
      if (!matchedRoute) {
        matchedRoute = "/dashboard"
      }

      const allowedRoles = matchedRoute ? protectedRoutes[matchedRoute] : undefined

      // Check if user has required role
      if (!token || !allowedRoles || !allowedRoles.includes(token.role as string)) {
        return NextResponse.redirect(new URL("/unauthorized", req.url))
      }

      // Redirect based on role if accessing root dashboard
      if (path === "/dashboard") {
        if (token.role === "ACCOUNTANT") {
          return NextResponse.redirect(new URL("/dashboard/accountant", req.url))
        } else if (token.role === "PROJECT_MANAGER") {
          return NextResponse.redirect(new URL("/dashboard/manager", req.url))
        }
        // Admin stays on /dashboard or can go to /dashboard/admin
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*"
  ]
}
