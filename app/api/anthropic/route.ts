import { NextRequest, NextResponse } from "next/server"

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"

export async function POST(req: NextRequest) {
  let apiKey: string
  let body: Record<string, unknown>

  try {
    const payload = await req.json()
    apiKey = String(payload.apiKey ?? "")
    body = payload.body as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!apiKey || !apiKey.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "Missing or invalid Anthropic API key" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Missing body" }, { status: 400 })
  }

  try {
    const upstream = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    })

    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: "Upstream request failed" }, { status: 502 })
  }
}
