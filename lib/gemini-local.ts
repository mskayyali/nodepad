"use client"

// ── Constants ────────────────────────────────────────────────────────────────

const CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com/v1internal"

// ── Token cache (module-level singleton) ─────────────────────────────────────

let cachedAccessToken: string | null = null
let cachedExpiryDate: number = 0
let inflightRefresh: Promise<string> | null = null

// ── Project cache ────────────────────────────────────────────────────────────

let cachedProjectId: string | null = null
let inflightProjectDiscovery: Promise<string> | null = null

// ── Token management ─────────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<{ access_token: string; expiry_date: number }> {
  const res = await fetch("/api/gemini-local/refresh", { method: "POST" })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = data.error ?? `Token refresh failed (${res.status})`
    throw new Error(msg)
  }
  return res.json()
}

async function getValidAccessToken(): Promise<string> {
  // Return cached token if still valid (60s buffer)
  if (cachedAccessToken && Date.now() < cachedExpiryDate - 60_000) {
    return cachedAccessToken
  }

  // Deduplicate concurrent refresh requests
  if (inflightRefresh) return inflightRefresh

  inflightRefresh = (async () => {
    try {
      const result = await refreshAccessToken()
      cachedAccessToken = result.access_token
      cachedExpiryDate = result.expiry_date
      return result.access_token
    } finally {
      inflightRefresh = null
    }
  })()

  return inflightRefresh
}

// ── Project discovery ────────────────────────────────────────────────────────

async function discoverProject(accessToken: string): Promise<string> {
  if (cachedProjectId) return cachedProjectId

  if (inflightProjectDiscovery) return inflightProjectDiscovery

  inflightProjectDiscovery = (async () => {
    try {
      const res = await fetch(`${CODE_ASSIST_ENDPOINT}:loadCodeAssist`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metadata: {
            ideType: "IDE_UNSPECIFIED",
            platform: "PLATFORM_UNSPECIFIED",
            pluginType: "GEMINI",
          },
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Project discovery failed (${res.status}): ${err}`)
      }

      const data = await res.json()
      const projectId = data.cloudaicompanionProject
      if (!projectId) {
        throw new Error("Account not eligible for Gemini Code Assist — no managed project returned")
      }

      cachedProjectId = projectId
      return projectId
    } finally {
      inflightProjectDiscovery = null
    }
  })()

  return inflightProjectDiscovery
}

// ── Request queue (semaphore with concurrency=1) ─────────────────────────────

const CONCURRENCY = 1
let activeRequests = 0
const waitQueue: (() => void)[] = []

function acquireSlot(): Promise<void> {
  if (activeRequests < CONCURRENCY) {
    activeRequests++
    return Promise.resolve()
  }
  return new Promise<void>(resolve => waitQueue.push(resolve))
}

function releaseSlot(): void {
  const next = waitQueue.shift()
  if (next) {
    // Hand the slot to the next waiter (activeRequests stays the same)
    next()
  } else {
    activeRequests--
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface GeminiGenerationConfig {
  temperature?: number
  responseMimeType?: string
  responseSchema?: object
}

/**
 * Call the CodeAssist generateContent API.
 *
 * @param model - Gemini model ID (e.g. "gemini-2.5-flash")
 * @param messages - Array of {role, content} messages. A message with role "system"
 *                   is sent as systemInstruction; all others go into contents.
 * @param generationConfig - Optional generation parameters.
 * @returns The text content from the first candidate.
 */
export async function geminiGenerateContent(
  model: string,
  messages: { role: string; content: string }[],
  generationConfig?: GeminiGenerationConfig,
): Promise<string> {
  await acquireSlot()
  try {
    return await _geminiGenerateContentInner(model, messages, generationConfig)
  } finally {
    releaseSlot()
  }
}

async function _geminiGenerateContentInner(
  model: string,
  messages: { role: string; content: string }[],
  generationConfig?: GeminiGenerationConfig,
): Promise<string> {
  const accessToken = await getValidAccessToken()
  const projectId = await discoverProject(accessToken)

  // Split system instruction from conversation contents
  const systemMessages = messages.filter(m => m.role === "system")
  const contentMessages = messages.filter(m => m.role !== "system")

  const systemInstruction = systemMessages.length > 0
    ? { role: "user", parts: [{ text: systemMessages.map(m => m.content).join("\n\n") }] }
    : undefined

  const contents = contentMessages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  const body = JSON.stringify({
    model,
    project: projectId,
    request: {
      contents,
      ...(systemInstruction && { systemInstruction }),
      ...(generationConfig && { generationConfig }),
    },
  })

  // Retry loop for rate limits (429) — up to 3 attempts with backoff
  const MAX_RETRIES = 3
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${CODE_ASSIST_ENDPOINT}:generateContent`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body,
    })

    if (res.ok) {
      const data = await res.json()
      const text = data.response?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        throw new Error("No content in Gemini response")
      }
      return text
    }

    const err = await res.text()

    // Rate limited — parse retry delay from response and wait
    if (res.status === 429 && attempt < MAX_RETRIES - 1) {
      const delayMatch = err.match(/reset after (\d+)s/)
      const delaySec = delayMatch ? Math.min(parseInt(delayMatch[1], 10), 120) : (attempt + 1) * 15
      await new Promise(resolve => setTimeout(resolve, delaySec * 1000))
      continue
    }

    // If token expired mid-request, clear cache so next call refreshes
    if (res.status === 401) {
      cachedAccessToken = null
      cachedExpiryDate = 0
    }

    throw new Error(`Gemini API error (${res.status}): ${err}`)
  }

  throw new Error("Gemini API: max retries exceeded")
}

/**
 * Check if Gemini (Local) credentials are configured.
 * Calls the server-side status endpoint.
 */
export async function checkGeminiLocalStatus(): Promise<{ configured: boolean; error?: string }> {
  try {
    const res = await fetch("/api/gemini-local/status")
    return res.json()
  } catch {
    return { configured: false, error: "Failed to check credential status" }
  }
}
