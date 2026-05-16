"use client"

export interface SessionUser {
  id: string
  username: string
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
    console.error("Auth request failed", error)
    return { error: "Unable to reach the server." }
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const result = await requestJson<{ user: SessionUser | null }>("/api/auth/session", { method: "GET" })
  if (result.error) return null
  return result.data?.user ?? null
}

export async function clearSession(): Promise<void> {
  await requestJson("/api/auth/logout", { method: "POST" })
}

export async function registerUser(username: string, password: string): Promise<{ user?: SessionUser; error?: string }> {
  const result = await requestJson<{ user: SessionUser }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })

  if (result.error) return { error: result.error }
  if (!result.data?.user) return { error: "Registration failed." }
  return { user: result.data.user }
}

export async function loginUser(username: string, password: string): Promise<{ user?: SessionUser; error?: string }> {
  const result = await requestJson<{ user: SessionUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })

  if (result.error) return { error: result.error }
  if (!result.data?.user) return { error: "Login failed." }
  return { user: result.data.user }
}
