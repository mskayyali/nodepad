import { z } from "zod"
import { getSessionUser } from "@/lib/server/auth"
import { prisma } from "@/lib/server/prisma"
import { INITIAL_PROJECTS } from "@/lib/initial-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const aiSettingsSchema = z.object({
  apiKey: z.string().optional(),
  modelId: z.string().optional(),
  webGrounding: z.boolean().optional(),
  provider: z.enum(["openrouter", "openai", "zai"]).optional(),
  customBaseUrl: z.string().optional(),
  openrouterCustomModelId: z.string().optional(),
  providerKeys: z.record(z.string()).optional(),
}).optional()

const stateSchema = z.object({
  projects: z.array(z.unknown()),
  activeProjectId: z.string().nullable().optional(),
  backupProjects: z.array(z.unknown()).nullable().optional(),
  introSeen: z.boolean().optional(),
  aiSettings: aiSettingsSchema,
})

function normalizeState(raw: {
  projects?: unknown
  activeProjectId?: unknown
  backupProjects?: unknown
  introSeen?: unknown
  aiSettings?: unknown
}) {
  const projects = Array.isArray(raw.projects) ? raw.projects : INITIAL_PROJECTS
  const activeProjectId = typeof raw.activeProjectId === "string"
    ? raw.activeProjectId
    : (projects[0] as any)?.id ?? null
  const backupProjects = Array.isArray(raw.backupProjects) ? raw.backupProjects : projects
  const introSeen = typeof raw.introSeen === "boolean" ? raw.introSeen : false
  const aiSettings = raw.aiSettings && typeof raw.aiSettings === "object" ? raw.aiSettings : null

  return { projects, activeProjectId, backupProjects, introSeen, aiSettings }
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 })
  }

  const state = await prisma.userState.findUnique({
    where: { userId: user.id },
  })

  if (!state) {
    const created = await prisma.userState.create({
      data: {
        userId: user.id,
        projects: INITIAL_PROJECTS,
        activeProjectId: INITIAL_PROJECTS[0]?.id ?? null,
        backupProjects: INITIAL_PROJECTS,
        introSeen: false,
      },
    })
    return Response.json({
      state: {
        projects: created.projects,
        activeProjectId: created.activeProjectId,
        backupProjects: created.backupProjects,
        introSeen: created.introSeen,
        aiSettings: created.aiSettings,
      },
    })
  }

  const normalized = normalizeState({
    projects: state.projects,
    activeProjectId: state.activeProjectId ?? undefined,
    backupProjects: state.backupProjects ?? undefined,
    introSeen: state.introSeen,
    aiSettings: state.aiSettings ?? undefined,
  })

  return Response.json({ state: normalized })
}

export async function PUT(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = stateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Invalid state payload." }, { status: 400 })
  }

  const normalized = normalizeState(parsed.data)

  const state = await prisma.userState.upsert({
    where: { userId: user.id },
    update: {
      projects: normalized.projects,
      activeProjectId: normalized.activeProjectId,
      backupProjects: normalized.backupProjects,
      introSeen: normalized.introSeen,
      aiSettings: normalized.aiSettings,
    },
    create: {
      userId: user.id,
      projects: normalized.projects,
      activeProjectId: normalized.activeProjectId,
      backupProjects: normalized.backupProjects,
      introSeen: normalized.introSeen,
      aiSettings: normalized.aiSettings,
    },
  })

  return Response.json({
    state: {
      projects: state.projects,
      activeProjectId: state.activeProjectId,
      backupProjects: state.backupProjects,
      introSeen: state.introSeen,
      aiSettings: state.aiSettings,
    },
  })
}
