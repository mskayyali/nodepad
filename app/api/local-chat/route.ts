import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy for chat completion requests to local AI servers (Ollama, LM Studio).
 * Needed because these servers typically don't set CORS headers, so the
 * browser blocks direct fetch requests from the app.
 *
 * Security: only allows requests when the app is running on localhost,
 * and only proxies to localhost targets. Disabled in production to prevent SSRF.
 *
 * POST { targetUrl: string, body: object }
 */

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"])
const ALLOWED_PORTS = new Set(["11434", "1234"])

function isLocalHost(host: string): boolean {
  // Strip port if present
  const hostname = host.replace(/:\d+$/, "")
  return ALLOWED_HOSTS.has(hostname)
}

function isAllowedTarget(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== "http:") return false
    if (!ALLOWED_HOSTS.has(url.hostname)) return false
    if (!ALLOWED_PORTS.has(url.port)) return false
    return true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // Only allow when the app itself is running on localhost
  const requestHost = req.headers.get("host") || ""
  if (!isLocalHost(requestHost)) {
    return NextResponse.json(
      { error: "Local proxy is only available when running on localhost" },
      { status: 403 },
    )
  }

  let payload: { targetUrl?: string; body?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { targetUrl, body } = payload

  if (!targetUrl || typeof targetUrl !== "string") {
    return NextResponse.json({ error: "targetUrl is required" }, { status: 400 })
  }

  if (!isAllowedTarget(targetUrl)) {
    return NextResponse.json(
      { error: "Only localhost Ollama/LM Studio URLs are allowed" },
      { status: 403 },
    )
  }

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const errText = await res.text()
      return new NextResponse(errText, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") || "text/plain" },
      })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Could not reach local server: ${message}` },
      { status: 502 },
    )
  }
}
