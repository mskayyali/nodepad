import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/server/prisma"
import { createSession } from "@/lib/server/auth"
import { INITIAL_PROJECTS } from "@/lib/initial-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const registerSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "Invalid input." }, { status: 400 })
  }

  const cleanUsername = parsed.data.username.trim()
  const normalized = cleanUsername.toLowerCase()

  const existing = await prisma.user.findUnique({
    where: { usernameNormalized: normalized },
  })
  if (existing) {
    return Response.json({ error: "An account with this username already exists." }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: cleanUsername,
        usernameNormalized: normalized,
        passwordHash,
      },
    })

    await tx.userState.create({
      data: {
        userId: created.id,
        projects: INITIAL_PROJECTS,
        activeProjectId: INITIAL_PROJECTS[0]?.id ?? null,
        backupProjects: INITIAL_PROJECTS,
        introSeen: false,
      },
    })

    return created
  })

  await createSession(user.id)

  return Response.json({ user: { id: user.id, username: user.username } })
}
