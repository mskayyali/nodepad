import { NextRequest, NextResponse } from "next/server"

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

function normalizeOllamaBase(base: string) {
  const trimmed = base.replace(/\/+$/, "")
  return trimmed.replace(/\/v1$/i, "").replace(/\/+$/, "")
}
async function fetchModelsFrom(base: string) {
  const normalizedBase = normalizeOllamaBase(base)
  const tryUrls = [
    `${normalizedBase}/v1/models`,
    `${normalizedBase}/models`,
  ]
  for (const url of tryUrls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const text = await res.text()
      try {
        const json = JSON.parse(text)
        // Ollama may return an array or an object with `models` or `data`.
        if (Array.isArray(json)) return json
        if (json && Array.isArray(json.models)) return json.models
        if (json && Array.isArray(json.data)) return json.data
        // Fallback: if it's an object with numeric-keyed items, try to map values
        if (json && typeof json === "object") {
          const vals = Object.values(json).filter(v => Array.isArray(v)).flat() as any[]
          if (vals.length > 0) return vals
        }
        return []
      } catch {
        continue
      }
    } catch {
      continue
    }
  }
  return []
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const requestedBaseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : ""
    const provided = requestedBaseUrl || DEFAULT_OLLAMA
    if (!provided) return NextResponse.json({ models: [] })

    // Validate that `provided` is an absolute HTTP(S) URL early and return 400 for bad input.
    try {
      // Will throw for non-absolute/invalid URLs
      const parsed = new URL(provided)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({ error: "Invalid baseUrl: only http:// and https:// URLs are allowed" }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: "Invalid baseUrl: must be an absolute URL using http:// or https://" }, { status: 400 })
    }

    // Do not allow arbitrary remote hosts in production — limit to local dev.
    if (!isLocalHost(provided) && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Remote baseUrl not allowed" }, { status: 403 })
    }

    const models = await fetchModelsFrom(provided)
    return NextResponse.json({ models })
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 502 })
  }
}
