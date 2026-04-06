import { NextRequest, NextResponse } from "next/server"

// ── SSRF protection (mirrors fetch-url/route.ts) ─────────────────────────────

function isBlockedHost(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return true
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true
  const h = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (h === "localhost") return true
  if (h === "metadata.google.internal") return true
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 0) return true
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
  }
  return false
}

// ── Proxy handler ───────────────────────────────────────────────────────────
// Proxies chat/completions requests to custom AI provider endpoints so the
// browser stays within CSP connect-src 'self'. Only used for custom and zai
// providers — OpenRouter and OpenAI are called directly from the browser.

const ALLOWED_PATH = "/chat/completions"

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, body, headers } = await req.json()

    if (!baseUrl || typeof baseUrl !== "string") {
      return NextResponse.json({ error: "Missing baseUrl" }, { status: 400 })
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Missing body" }, { status: 400 })
    }
    if (!headers || typeof headers !== "object") {
      return NextResponse.json({ error: "Missing headers" }, { status: 400 })
    }

    // Validate the target URL
    const targetUrl = baseUrl.replace(/\/$/, "") + ALLOWED_PATH
    try {
      const parsed = new URL(targetUrl)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return NextResponse.json({ error: "Invalid protocol" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid baseUrl" }, { status: 400 })
    }

    if (isBlockedHost(targetUrl)) {
      return NextResponse.json({ error: "Blocked URL — private addresses not allowed" }, { status: 400 })
    }

    // Forward the request
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000) // 30s timeout

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: String(headers["Authorization"] || ""),
          ...Object.fromEntries(
            Object.entries(headers).filter(([k]) => k !== "Authorization" && k !== "Content-Type")
          ),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      let data: unknown
      try {
        data = await response.json()
      } catch {
        const raw = await response.text().catch(() => "")
        return NextResponse.json(
          { error: `Upstream returned invalid JSON (HTTP ${response.status})${raw ? `: ${raw.substring(0, 200)}` : ""}` },
          { status: 502 },
        )
      }
      return NextResponse.json(data, { status: response.status })
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 })
    }
    return NextResponse.json({ error: "Proxy error" }, { status: 502 })
  }
}
