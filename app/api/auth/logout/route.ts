import { deleteSessionByToken } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  await deleteSessionByToken()
  return Response.json({ ok: true })
}
