import { NextResponse } from "next/server"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

const CREDS_PATH = join(process.cwd(), "gemini-creds.json")

export async function GET() {
  try {
    if (!existsSync(CREDS_PATH)) {
      return NextResponse.json({ configured: false, error: "Credentials file not found. See docs/gemini-local-setup.md" })
    }
    const raw = readFileSync(CREDS_PATH, "utf-8")
    const creds = JSON.parse(raw)
    if (!creds.refresh_token) {
      return NextResponse.json({ configured: false, error: "Credentials file is missing refresh_token" })
    }
    return NextResponse.json({ configured: true })
  } catch {
    return NextResponse.json({ configured: false, error: "Failed to read credentials file" })
  }
}
