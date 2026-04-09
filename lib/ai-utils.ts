import type { AIProvider } from "@/lib/ai-settings"

export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "")
}

export function isLocalBase(raw: string): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw)
    const h = u.hostname.toLowerCase()
    return h === "localhost" || h === "127.0.0.1" || h === "::1"
  } catch {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(raw)
  }
}

export function buildTryEndpoints(provider: AIProvider, normalizedBase: string): string[] {
  return provider === "ollama" || isLocalBase(normalizedBase)
    ? ["/api/ollama"]
    : ["/v1/chat/completions", "/chat/completions"]
}

export function joinEndpoint(base: string, path: string): string {
  if (base.endsWith("/v1") && path.startsWith("/v1")) {
    path = path.slice(3)
  }
  return base + path
}
