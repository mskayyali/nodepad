import crypto from "node:crypto"
import { cookies, headers } from "next/headers"
import { prisma } from "@/lib/server/prisma"

const SESSION_COOKIE = "nodepad_session"
const SESSION_MAX_AGE_DAYS = 30
const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

async function getRequestMetadata() {
  const headerList = await headers()
  const forwardedFor = headerList.get("x-forwarded-for")
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null
  const userAgent = headerList.get("user-agent")
  return { ipAddress, userAgent }
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex")
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
  const { ipAddress, userAgent } = await getRequestMetadata()

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, buildCookieOptions())
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 })
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const tokenHash = hashToken(token)
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!session) {
    await clearSessionCookie()
    return null
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } })
    await clearSessionCookie()
    return null
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  })

  return { id: session.user.id, username: session.user.username }
}

export async function deleteSessionByToken() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return
  const tokenHash = hashToken(token)
  const session = await prisma.session.findUnique({ where: { tokenHash } })
  if (session) {
    await prisma.session.delete({ where: { id: session.id } })
  }
  await clearSessionCookie()
}
