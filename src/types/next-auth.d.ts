import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      projectIds: string[]
      canViewAllProjects: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email: string
    name: string
    role: string
    projectIds: string[]
    canViewAllProjects: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    projectIds: string[]
    canViewAllProjects: boolean
  }
}
