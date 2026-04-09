import { NextRequest, NextResponse } from "next/server"

const OLLAMA_BASE = "http://localhost:11434"

/**
 * Catch-all proxy for the local Ollama server.
 * Maps /api/ollama/<path> → http://localhost:11434/<path>
 *
 * This avoids CORS issues when the app is accessed from a LAN IP.
 *
 * Examples:
 *   GET  /api/ollama/api/tags        → GET  http://localhost:11434/api/tags
 *   POST /api/ollama/v1/chat/completions → POST http://localhost:11434/v1/chat/completions
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const target = `${OLLAMA_BASE}/${path.join("/")}`
  try {
    const res = await fetch(target, { signal: AbortSignal.timeout(5000) })
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
    })
  } catch {
    return NextResponse.json({ error: "Ollama unreachable" }, { status: 502 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const target = `${OLLAMA_BASE}/${path.join("/")}`
  try {
    const body = await req.text()
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(120_000),
    })
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
    })
  } catch {
    return NextResponse.json({ error: "Ollama unreachable" }, { status: 502 })
  }
}
