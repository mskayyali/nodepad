"use client"

import type { Project } from "@/lib/types"
import type { AISettings } from "@/lib/ai-settings"

export interface UserState {
  projects: Project[]
  activeProjectId: string | null
  backupProjects: Project[] | null
  introSeen: boolean
  aiSettings?: AISettings | null
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...init,
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { error: payload?.error || "Request failed." }
    }

    return { data: payload as T }
  } catch (error) {
    console.error("User state request failed", error)
    return { error: "Unable to reach the server." }
  }
}

export async function fetchUserState(): Promise<UserState | null> {
  const result = await requestJson<{ state: UserState }>("/api/user-state", { method: "GET" })
  if (result.error) return null
  return result.data?.state ?? null
}

export async function saveUserState(state: UserState): Promise<UserState | null> {
  const result = await requestJson<{ state: UserState }>("/api/user-state", {
    method: "PUT",
    body: JSON.stringify(state),
  })
  if (result.error) return null
  return result.data?.state ?? null
}
