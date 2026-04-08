import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy for chat completion requests to local AI servers (Ollama, LM Studio).
 * Needed because these servers typically don't set CORS headers, so the
 * browser blocks direct fetch requests from the app.
 *
 * POST { targetUrl: string, body: object }
 * The targetUrl must point to localhost.
 */

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"])

function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== "http:" && url.protocol !== "https:") return false
    return ALLOWED_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
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

  if (!isAllowedUrl(targetUrl)) {
    return NextResponse.json({ error: "Only localhost URLs are allowed" }, { status: 403 })
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
