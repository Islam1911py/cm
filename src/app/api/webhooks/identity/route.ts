import { NextRequest, NextResponse } from "next/server"

import type { Prisma } from "@prisma/client"

import { db } from "@/lib/db"
import { verifyN8nApiKey, logWebhookEvent } from "@/lib/n8n-auth"
import { buildPhoneVariants } from "@/lib/phone"

const MANAGED_ROLES = ["ADMIN", "ACCOUNTANT", "PROJECT_MANAGER"] as const

type ManagedRole = (typeof MANAGED_ROLES)[number]

type HumanReadable = {
  ar: string
}

type Suggestion = {
  title: string
  prompt: string
  data?: Record<string, unknown>
}

type ContactResult =
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
      id: string
      name: string | null
      phone: string | null
      whatsappPhone: string | null
      unit: {
        id: string
        code: string
        name: string | null
        project: {
          id: string
          name: string | null
        } | null
      }
    }

type ResponseBody = {
  success: boolean
  input: string
  contact: ContactResult | null
  matchScore: number
  humanReadable?: HumanReadable
  suggestions?: Suggestion[]
}

function buildUnknownResponse(input: string): ResponseBody {
  return {
    success: false,
    input,
    contact: null,
    matchScore: 0,
    humanReadable: {
      ar: `لم يتم العثور على جهة اتصال للرقم ${input}.`
    },
    suggestions: [
      {
        title: "تأكيد الرقم",
        prompt: "تأكد من الرقم الكامل مع كود الدولة أو أرسل الاسم المرتبط به."
      }
    ]
  }
}

export async function POST(req: NextRequest) {
  const ipAddress = req.headers.get("x-forwarded-for") || "unknown"

  try {
    const auth = await verifyN8nApiKey(req)
    if (!auth.valid || !auth.context) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const inputRaw = body?.phone ?? body?.senderPhone ?? body?.contact ?? body?.query
    const input = typeof inputRaw === "string" ? inputRaw.trim() : ""

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          error: "phone is required",
          humanReadable: {
            ar: "أرسل رقم الهاتف المطلوب التعرف عليه."
          }
        },
        { status: 400 }
      )
    }

    const phoneVariants = buildPhoneVariants(input)

    type UserWithAssignments = Prisma.UserGetPayload<{
      include: {
        assignedProjects: {
          select: {
            projectId: true;
            project: { select: { id: true; name: true } };
          };
        };
      };
    }>

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
                project: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        })
      : null) as UserWithAssignments | null

    let responseBody: ResponseBody

    if (userMatch && MANAGED_ROLES.includes(userMatch.role as ManagedRole)) {
      const role = userMatch.role as ManagedRole
      const assignedProjects =
        userMatch.assignedProjects?.map((assignment) => ({
          id: assignment.project?.id ?? assignment.projectId,
          name: assignment.project?.name ?? assignment.projectId
        })) ?? []

      const shouldLoadAllProjects = role === "ADMIN" || role === "ACCOUNTANT" || !!userMatch.canViewAllProjects

      const projects = shouldLoadAllProjects
        ? await db.project.findMany({
            select: {
              id: true,
              name: true
            },
            orderBy: {
              name: "asc"
            }
          })
        : assignedProjects

      const projectEntries = shouldLoadAllProjects
        ? projects.map((project) => ({ id: project.id, name: project.name }))
        : assignedProjects

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

      responseBody = {
        success: true,
        input,
        contact,
        matchScore: 1,
        humanReadable: {
          ar: `الرقم ${input} يعود إلى ${contact.name ?? "مستخدم"} (${contact.role}).`
        },
        suggestions: contact.role === "PROJECT_MANAGER"
          ? [
              {
                title: "عرض مشاريع المدير",
                prompt: "اذكر المشاريع المكلف بها هذا المدير.",
                data: {
                  managerId: contact.id,
                  projects: contact.projects
                }
              }
            ]
          : undefined
      }
    } else {
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
                  project: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          })
        : null

      if (residentMatch) {
        const contact: ContactResult = {
          type: "RESIDENT",
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

        responseBody = {
          success: true,
          input,
          contact,
          matchScore: 0.8,
          humanReadable: {
            ar: `الرقم ${input} يخص الساكن ${contact.name ?? "بدون اسم"} في الوحدة ${contact.unit.code}.`
          },
          suggestions: [
            {
              title: "عرض تذاكر الساكن",
              prompt: "هات التذاكر المرتبطة بهذا الساكن.",
              data: {
                residentId: contact.id,
                unitId: contact.unit.id
              }
            }
          ]
        }
      } else {
        responseBody = buildUnknownResponse(input)
      }
    }

    await logWebhookEvent(
      auth.context.keyId,
      "CONTACT_IDENTIFIED",
      "/api/webhooks/identity",
      "POST",
      responseBody.success ? 200 : 404,
      body,
      responseBody,
      responseBody.success ? undefined : "Contact not found",
      ipAddress
    )

    return NextResponse.json(responseBody, { status: responseBody.success ? 200 : 404 })
  } catch (error) {
    console.error("CONTACT_IDENTIFY_ERROR", error)

    const auth = await verifyN8nApiKey(req)
    if (auth.context) {
      await logWebhookEvent(
        auth.context.keyId,
        "CONTACT_IDENTIFIED",
        "/api/webhooks/identity",
        "POST",
        500,
        undefined,
        { error: "Internal server error" },
        error instanceof Error ? error.message : "Unknown error",
        ipAddress
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to identify contact"
      },
      { status: 500 }
    )
  }
}
