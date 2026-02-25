import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { chromium } from "playwright"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id || id === "undefined") {
    return NextResponse.json({ error: "Missing invoice id" }, { status: 400 })
  }

  const baseUrl = request.nextUrl.origin
  const targetUrl = new URL(`/dashboard/invoices/${id}?print=1`, baseUrl)
  const cookieStore = await cookies()
  const cookieValues = cookieStore.getAll()
  const baseHost = new URL(baseUrl).hostname

  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({
      locale: "ar-EG",
      timezoneId: "Africa/Cairo",
    })

    if (cookieValues.length > 0) {
      await context.addCookies(
        cookieValues.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: baseHost,
          path: "/",
        }))
      )
    }

    const page = await context.newPage()
    await page.goto(targetUrl.toString(), { waitUntil: "networkidle" })
    await page.emulateMedia({ media: "print" })

    if (page.url().includes("/login")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    })

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${id}.pdf"`,
      },
    })
  } finally {
    await browser.close()
  }
}
