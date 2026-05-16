import { z } from "zod"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/server/prisma"
import { createSession } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
})

function isDatabaseUnavailable(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError
    || error instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return true
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes("can't reach database server")
      || message.includes("econnrefused")
      || message.includes("connection refused")
      || message.includes("timeout")
  }
  return false
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 })
  }

  try {
    const normalized = parsed.data.username.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { usernameNormalized: normalized },
    })

    if (!user) {
      return Response.json({ error: "No account found for this username." }, { status: 401 })
    }

    const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash)
    if (!passwordOk) {
      return Response.json({ error: "Incorrect password." }, { status: 401 })
    }

    await createSession(user.id)

    return Response.json({ user: { id: user.id, username: user.username } })
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return Response.json(
        { error: "Database not connected. Please check your PostgreSQL connection." },
        { status: 503 },
      )
    }
    console.error("Login failed", error)
    return Response.json({ error: "Login failed." }, { status: 500 })
  }
}
