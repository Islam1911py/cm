import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { buildPhoneVariants } from "@/lib/phone"

const MANAGED_ROLES = ["ADMIN", "ACCOUNTANT", "PROJECT_MANAGER"] as const
type ManagedRole = (typeof MANAGED_ROLES)[number]

export type ContactResult =
  | {
      type: "USER"
      role: ManagedRole
      id: string
      name: string | null
      whatsappPhone: string | null
      phone?: string | null
      email?: string | null
      canViewAllProjects: boolean
      projects: Array<{ id: string; name: string | null }>
    }
  | {
      type: "RESIDENT"
      role: "RESIDENT"
      id: string
      name: string | null
      phone: string | null
      whatsappPhone: string | null
      unit: {
        id: string
        code: string
        name: string | null
        project: { id: string; name: string | null } | null
      }
    }
  | {
      type: "UNREGISTERED"
      role: "UNREGISTERED"
      phone: string
    }

export type IdentityResponseBody = {
  success: boolean
  input: string
  contact: ContactResult
  matchScore: number
  humanReadable?: { ar: string }
  suggestions?: Array<{ title: string; prompt: string; data?: Record<string, unknown> }>
}

type UserWithAssignments = Prisma.UserGetPayload<{
  include: {
    assignedProjects: {
      select: {
        projectId: true
        project: { select: { id: true; name: true } }
      }
    }
  }
}>

/**
 * Identify contact by phone: returns USER, RESIDENT, or UNREGISTERED.
 * Used by /api/webhooks/identity and POST /api/residents (when x-api-key + action IDENTITY).
 */
export async function identifyContactByPhone(input: string): Promise<IdentityResponseBody> {
  const phoneVariants = buildPhoneVariants(input)

  const userMatch = (phoneVariants.length
    ? await db.user.findFirst({
        where: {
          role: { in: [...MANAGED_ROLES] },
          OR: [
            { whatsappPhone: { in: phoneVariants } },
            { email: { in: phoneVariants } }
          ]
        },
        include: {
          assignedProjects: {
            select: {
              projectId: true,
              project: { select: { id: true, name: true } }
            }
          }
        }
      })
    : null) as UserWithAssignments | null

  if (userMatch && MANAGED_ROLES.includes(userMatch.role as ManagedRole)) {
    const role = userMatch.role as ManagedRole
    const assignedProjects =
      userMatch.assignedProjects?.map((a) => ({
        id: a.project?.id ?? a.projectId,
        name: a.project?.name ?? a.projectId
      })) ?? []
    const shouldLoadAllProjects = role === "ADMIN" || role === "ACCOUNTANT" || !!userMatch.canViewAllProjects
    const projects = shouldLoadAllProjects
      ? await db.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : assignedProjects
    const projectEntries = projects.map((p) => ({ id: p.id, name: p.name }))
    const contact: ContactResult = {
      type: "USER",
      role,
      id: userMatch.id,
      name: userMatch.name,
      whatsappPhone: userMatch.whatsappPhone,
      phone: (userMatch as { phone?: string | null }).phone ?? null,
      email: userMatch.email,
      canViewAllProjects: shouldLoadAllProjects,
      projects: projectEntries
    }
    return {
      success: true,
      input,
      contact,
      matchScore: 1,
      humanReadable: { ar: `الرقم ${input} يعود إلى ${contact.name ?? "مستخدم"} (${contact.role}).` },
      suggestions: contact.role === "PROJECT_MANAGER"
        ? [{ title: "عرض مشاريع المدير", prompt: "اذكر المشاريع المكلف بها هذا المدير.", data: { managerId: contact.id, projects: contact.projects } }]
        : undefined
    }
  }

  const residentMatch = phoneVariants.length
    ? await db.resident.findFirst({
        where: {
          OR: [
            { phone: { in: phoneVariants } },
            { whatsappPhone: { in: phoneVariants } }
          ]
        },
        include: {
          unit: {
            select: {
              id: true,
              code: true,
              name: true,
              project: { select: { id: true, name: true } }
            }
          }
        }
      })
    : null

  if (residentMatch) {
    const contact: ContactResult = {
      type: "RESIDENT",
      role: "RESIDENT",
      id: residentMatch.id,
      name: residentMatch.name,
      phone: residentMatch.phone,
      whatsappPhone: residentMatch.whatsappPhone,
      unit: {
        id: residentMatch.unit.id,
        code: residentMatch.unit.code,
        name: residentMatch.unit.name,
        project: residentMatch.unit.project
      }
    }
    return {
      success: true,
      input,
      contact,
      matchScore: 0.8,
      humanReadable: { ar: `الرقم ${input} يخص الساكن ${contact.name ?? "بدون اسم"} في الوحدة ${contact.unit.code}.` },
      suggestions: [
        { title: "عرض تذاكر الساكن", prompt: "هات التذاكر المرتبطة بهذا الساكن.", data: { residentId: contact.id, unitId: contact.unit.id } }
      ]
    }
  }

  return {
    success: false,
    input,
    contact: { type: "UNREGISTERED", role: "UNREGISTERED", phone: input },
    matchScore: 0,
    humanReadable: { ar: "رقم غير مسجل." },
    suggestions: [{ title: "تأكيد الرقم", prompt: "تأكد من الرقم الكامل مع كود الدولة أو أرسل الاسم المرتبط به." }]
  }
}
