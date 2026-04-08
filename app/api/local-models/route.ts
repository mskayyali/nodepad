import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy for fetching model lists from local AI servers (Ollama, LM Studio).
 * Needed because these servers typically don't set CORS headers, so the
 * browser blocks direct fetch requests from the app.
 *
 * Security:
 * - Disabled entirely in production (NODE_ENV check)
 * - Only proxies to localhost targets on ports 11434/1234
 *
 * POST { provider: "ollama" | "lmstudio", baseUrl?: string }
 */

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"])
const ALLOWED_PORTS = new Set(["11434", "1234"])

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
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Local proxy is only available in development" },
      { status: 403 },
    )
  }

  let body: { provider?: string; baseUrl?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { provider, baseUrl } = body

  if (provider !== "ollama" && provider !== "lmstudio") {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
  }

  const defaultBaseUrl = provider === "ollama"
    ? "http://localhost:11434/v1"
    : "http://localhost:1234/v1"

  const targetBase = baseUrl || defaultBaseUrl

  if (!isAllowedTarget(targetBase)) {
    return NextResponse.json(
      { error: "Only localhost Ollama/LM Studio URLs are allowed" },
      { status: 403 },
    )
  }

  try {
    let url: string
    if (provider === "ollama") {
      url = targetBase.replace(/\/v1\/?$/, "") + "/api/tags"
    } else {
      url = targetBase.replace(/\/$/, "") + "/models"
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream returned ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: `Could not reach ${provider}: ${message}` }, { status: 502 })
  }
}
