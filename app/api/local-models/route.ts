import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy for fetching model lists from local AI servers (Ollama, LM Studio).
 * Needed because these servers typically don't set CORS headers, so the
 * browser blocks direct fetch requests from the app.
 *
 * POST { provider: "ollama" | "lmstudio", baseUrl?: string }
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

  if (!isAllowedUrl(targetBase)) {
    return NextResponse.json({ error: "Only localhost URLs are allowed" }, { status: 403 })
  }

  try {
    let url: string
    if (provider === "ollama") {
      // Use Ollama's native /api/tags endpoint for richer metadata
      url = targetBase.replace(/\/v1\/?$/, "") + "/api/tags"
    } else {
      // LM Studio uses OpenAI-compatible /v1/models
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
