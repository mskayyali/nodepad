import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy for chat completion requests to local AI servers (Ollama, LM Studio).
 * Needed because these servers typically don't set CORS headers, so the
 * browser blocks direct fetch requests from the app.
 *
 * Security:
 * - Disabled in production by default; opt-in with NODEPAD_ENABLE_LOCAL_PROXY_IN_PROD=1
 * - Only proxies to localhost targets (provider-default ports in production)
 *
 * POST { provider: "ollama" | "lmstudio", baseUrl?: string, body: object }
 */

type LocalProvider = "ollama" | "lmstudio"

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])
const DEFAULT_BASE_URL: Record<LocalProvider, string> = {
  ollama: "http://localhost:11434/v1",
  lmstudio: "http://localhost:1234/v1",
}
const ALLOWED_PORTS: Record<LocalProvider, string> = {
  ollama: "11434",
  lmstudio: "1234",
}
const IS_PRODUCTION = process.env.NODE_ENV === "production"
const ENABLE_IN_PROD =
  !IS_PRODUCTION ||
  process.env.NODEPAD_ENABLE_LOCAL_PROXY_IN_PROD === "1" ||
  process.env.NODEPAD_ENABLE_LOCAL_PROXY_IN_PROD === "true"

function isLocalProvider(value: unknown): value is LocalProvider {
  return value === "ollama" || value === "lmstudio"
}

function normalizeAndValidateBaseUrl(provider: LocalProvider, baseUrl?: string): URL | null {
  const raw = baseUrl?.trim() || DEFAULT_BASE_URL[provider]
  try {
    const url = new URL(raw)
    if (url.protocol !== "http:") return null
    if (url.username || url.password) return null
    if (!ALLOWED_HOSTS.has(url.hostname)) return null
    if (!url.port) return null
    const port = Number(url.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null
    if (IS_PRODUCTION && url.port !== ALLOWED_PORTS[provider]) return null
    if (url.search || url.hash) return null
    return url
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  if (!ENABLE_IN_PROD) {
    return NextResponse.json(
      {
        error:
          "Local proxy is disabled in production. Set NODEPAD_ENABLE_LOCAL_PROXY_IN_PROD=1 to enable self-hosted local providers.",
      },
      { status: 403 },
    )
  }

  let payload: { provider?: unknown; baseUrl?: unknown; body?: unknown }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!isLocalProvider(payload.provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 })
  }
  const provider = payload.provider
  const customBaseUrl = typeof payload.baseUrl === "string" ? payload.baseUrl : undefined
  const body = payload.body

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be a JSON object" }, { status: 400 })
  }

  const baseUrl = normalizeAndValidateBaseUrl(provider, customBaseUrl)
  if (!baseUrl) {
    const message = IS_PRODUCTION
      ? "Only localhost Ollama/LM Studio URLs with default ports are allowed in production"
      : "Only localhost URLs with explicit ports are allowed"
    return NextResponse.json(
      { error: message },
      { status: 403 },
    )
  }
  const targetBase = `${baseUrl.origin}${baseUrl.pathname}`.replace(/\/$/, "")
  const targetUrl = `${targetBase.replace(/\/v1\/?$/, "")}/v1/chat/completions`

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
