import { NextRequest, NextResponse } from "next/server"
import { normalizeBaseUrl } from "@/lib/ai-utils"


export const runtime = "nodejs"

const DEFAULT_OLLAMA = process.env.OLLAMA_BASE_URL || "http://localhost:11434"

function isLocalHost(raw: string) {
  try {
    const u = new URL(raw)
    const h = u.hostname.toLowerCase()
    return h === "localhost" || h === "127.0.0.1" || h === "::1"
  } catch {
    return false
  }
}

async function forwardToOllama(body: any, forwardAuth?: string, providedBase?: string) {
  const baseCandidate = normalizeBaseUrl(providedBase || DEFAULT_OLLAMA)
  if (!baseCandidate) {
    return { ok: false, status: 400, json: { error: "No base URL provided" } }
  }

  // Validate that baseCandidate is an absolute http(s) URL — return 400 rather than a confusing 502.
  try {
    const parsed = new URL(baseCandidate)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, status: 400, json: { error: "Invalid baseUrl: must use http or https scheme" } }
    }
  } catch {
    return { ok: false, status: 400, json: { error: "Invalid baseUrl: must be an absolute URL (include scheme)" } }
  }

  // Disallow non-local remote hosts in production — return 403 rather than throwing.
  if (!isLocalHost(baseCandidate) && process.env.NODE_ENV === "production") {
    return { ok: false, status: 403, json: { error: "Remote baseUrl not allowed in production" } }
  }

  const base = baseCandidate.replace(/\/v1$/i, "")
  const tryEndpoints = [`${base}/v1/chat/completions`, `${base}/chat/completions`]

  // Try to fetch available models and ensure the requested model exists.
  try {
    const mres = await fetch(`${base}/v1/models`)
    if (mres.ok) {
      const txt = await mres.text()
      try {
        const json = JSON.parse(txt)
        const list = Array.isArray(json) ? json : json.models ?? json.data ?? []
        const ids = (list || []).map((m: any) => m?.id || m?.model || String(m))
        if (ids.length > 0 && body && body.model && !ids.includes(body.model)) {
          // Replace with the first available model to avoid 400s from Ollama
          body.model = ids[0]
        }
      } catch {
        // ignore parse failures
      }
    }
  } catch {
    // ignore errors fetching models — we'll try the completions endpoints directly
  }

  let lastErr: unknown = null
  for (const ep of tryEndpoints) {
    try {
      const res = await fetch(ep, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(forwardAuth ? { Authorization: forwardAuth } : {}),
        },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      let parsed: any = null
      try { parsed = JSON.parse(text) } catch { /* not JSON */ }
      if (res.ok) return { ok: res.ok, status: res.status, json: parsed, text: parsed ? undefined : text }
      // If route not found, try next candidate
      if (res.status === 404 || res.status === 405) continue
      return { ok: res.ok, status: res.status, json: parsed, text: parsed ? undefined : text }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error("No endpoints reachable")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const forwardAuth = req.headers.get("authorization") || undefined
    const { baseUrl, ...sanitizedBody } = (body && typeof body === "object") ? body as Record<string, any> : {}
    const providedBase = baseUrl ? String(baseUrl) : undefined
    const result = await forwardToOllama(sanitizedBody, forwardAuth, providedBase)
    if (result.json) return NextResponse.json(result.json, { status: result.status })
    if (result.text) return new NextResponse(result.text, { status: result.status })
    return NextResponse.json({ error: "Unknown response from Ollama" }, { status: 502 })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 502 })
  }
}
