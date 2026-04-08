import { NextRequest, NextResponse } from "next/server"

/**
 * Proxy for fetching model lists from local AI servers (Ollama, LM Studio).
 * Needed because these servers typically don't set CORS headers, so the
 * browser blocks direct fetch requests from the app.
 *
 * Security:
 * - Disabled in production by default; opt-in with NODEPAD_ENABLE_LOCAL_PROXY_IN_PROD=1
 * - Only proxies to localhost targets on provider-default ports
 *
 * POST { provider: "ollama" | "lmstudio", baseUrl?: string }
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
const ENABLE_IN_PROD =
  process.env.NODE_ENV !== "production" ||
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
    if (url.port !== ALLOWED_PORTS[provider]) return null
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

  let payload: { provider?: unknown; baseUrl?: unknown }
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
  const baseUrl = normalizeAndValidateBaseUrl(provider, customBaseUrl)
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Only localhost Ollama/LM Studio URLs with default ports are allowed" },
      { status: 403 },
    )
  }
  const targetBase = `${baseUrl.origin}${baseUrl.pathname}`.replace(/\/$/, "")
  const targetRoot = targetBase.replace(/\/v1\/?$/, "")

  try {
    const url = provider === "ollama"
      ? `${targetRoot}/api/tags`
      : `${targetRoot}/v1/models`

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
