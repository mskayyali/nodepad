import { NextResponse } from "next/server"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

const CREDS_PATH = join(process.cwd(), "gemini-creds.json")

// Gemini CLI's public OAuth client credentials — loaded from .env.local
const OAUTH_CLIENT_ID = process.env.GEMINI_OAUTH_CLIENT_ID ?? ""
const OAUTH_CLIENT_SECRET = process.env.GEMINI_OAUTH_CLIENT_SECRET ?? ""

export async function POST() {
  try {
    if (!existsSync(CREDS_PATH)) {
      return NextResponse.json({ error: "Credentials file not found" }, { status: 404 })
    }

    const raw = readFileSync(CREDS_PATH, "utf-8")
    const creds = JSON.parse(raw)
    if (!creds.refresh_token) {
      return NextResponse.json({ error: "No refresh_token in credentials file" }, { status: 400 })
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: creds.refresh_token,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json(
        { error: `Token refresh failed: ${err}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json({
      access_token: data.access_token,
      expiry_date: Date.now() + (data.expires_in ?? 3599) * 1000,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Refresh failed" }, { status: 500 })
  }
}
