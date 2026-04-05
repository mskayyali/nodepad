"use client"

import { useState, useEffect, useCallback } from "react"

export interface AIModel {
  id: string
  label: string
  shortLabel: string
  description: string
  supportsGrounding: boolean
}

export type AIProvider = "openrouter" | "openai" | "zai" | "custom"

export interface AIProviderPreset {
  id: AIProvider
  label: string
  baseUrl: string
  keyUrl: string
  keyPlaceholder: string
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/settings/keys",
    keyPlaceholder: "sk-or-v1-...",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  {
    id: "zai",
    label: "Z.ai",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    keyUrl: "https://z.ai",
    keyPlaceholder: "Your Z.ai API key",
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    keyUrl: "",
    keyPlaceholder: "",
  },
]

export function getPreset(provider: AIProvider): AIProviderPreset {
  return AI_PROVIDER_PRESETS.find(p => p.id === provider) || AI_PROVIDER_PRESETS[0]
}

export const AI_MODELS: AIModel[] = [
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    shortLabel: "Claude",
    description: "Best reasoning & annotation quality",
    supportsGrounding: false,
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    shortLabel: "GPT-4o",
    description: "Strong structured output, broad knowledge",
    supportsGrounding: true,
  },
  {
    id: "google/gemini-2.5-pro-preview-03-25",
    label: "Gemini 2.5 Pro",
    shortLabel: "Gemini",
    description: "Long-context, web grounding available",
    supportsGrounding: true,
  },
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek V3",
    shortLabel: "DeepSeek",
    description: "Cost-efficient frontier model",
    supportsGrounding: false,
  },
  {
    id: "mistralai/mistral-small-3.2-24b-instruct",
    label: "Mistral Small 3.2",
    shortLabel: "Mistral",
    description: "Fast, excellent structured outputs",
    supportsGrounding: false,
  },
]

export const OPENAI_MODELS: AIModel[] = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    shortLabel: "GPT-4o",
    description: "Strong structured output, broad knowledge",
    supportsGrounding: false,
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    shortLabel: "GPT-4.1",
    description: "Latest GPT-4, improved instruction following",
    supportsGrounding: false,
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    shortLabel: "GPT-4.1 Mini",
    description: "Fast and capable, good balance",
    supportsGrounding: false,
  },
  {
    id: "o4-mini",
    label: "o4-mini",
    shortLabel: "o4-mini",
    description: "Fast reasoning model",
    supportsGrounding: false,
  },
]

export function getModelsForProvider(provider: AIProvider): AIModel[] {
  switch (provider) {
    case "openrouter": return AI_MODELS
    case "openai":     return OPENAI_MODELS
    case "zai":        return []
    case "custom":     return []
  }
}

export const DEFAULT_MODEL_ID = "openai/gpt-4o"
export const DEFAULT_PROVIDER: AIProvider = "openrouter"

export interface AISettings {
  apiKey: string
  modelId: string
  webGrounding: boolean
  provider: AIProvider
  customBaseUrl: string
}

const STORAGE_KEY = "nodepad-ai-settings"

function loadSettings(): AISettings {
  if (typeof window === "undefined") {
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "", ...JSON.parse(raw) }
  } catch {
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
  }
}

export interface AIConfig {
  apiKey: string
  modelId: string
  supportsGrounding: boolean
  provider: AIProvider
  customBaseUrl: string
}

export function loadAIConfig(): AIConfig | null {
  const s = loadSettings()
  if (!s.apiKey) return null
  if (!s.modelId) return null
  const models = getModelsForProvider(s.provider)
  const model = models.find(m => m.id === s.modelId)
  const modelId = s.modelId || (models[0]?.id ?? DEFAULT_MODEL_ID)
  const supportsGrounding = s.provider === "openrouter" && (model?.supportsGrounding ?? false)
  return { apiKey: s.apiKey, modelId, supportsGrounding, provider: s.provider, customBaseUrl: s.customBaseUrl }
}

export function getBaseUrl(config: AIConfig): string {
  if ((config.provider === "custom" || config.provider === "zai") && config.customBaseUrl) {
    return config.customBaseUrl.replace(/\/$/, "")
  }
  return getPreset(config.provider).baseUrl
}

/** Whether this provider should route through the server proxy (custom/zai)
 *  to stay within CSP connect-src. */
export function shouldUseProxy(config: AIConfig): boolean {
  return (config.provider === "custom" || config.provider === "zai") && !!config.customBaseUrl
}

export function getProviderHeaders(config: AIConfig): Record<string, string> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  }
  if (config.provider === "openrouter") {
    base["HTTP-Referer"] = "https://nodepad.space"
    base["X-Title"] = "nodepad"
  }
  return base
}

/** Proxied chat/completion fetch for custom/zai providers.
 *  Sends the request through /api/ai-proxy to stay within CSP 'self'. */
export async function proxyChatCompletion(
  config: AIConfig,
  body: Record<string, unknown>,
): Promise<Response> {
  const baseUrl = getBaseUrl(config)
  const res = await fetch("/api/ai-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl,
      body,
      headers: getProviderHeaders(config),
    }),
  })
  // The proxy returns the upstream status code and JSON body
  return res
}

/** Validate a custom base URL. Returns an error message or null if valid. */
export function validateCustomBaseUrl(url: string): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "URL must start with https:// or http://"
    }
    if (!parsed.hostname.includes(".")) {
      return "URL must include a valid hostname"
    }
    if (isBlockedHost(url)) {
      return "Private and local addresses are not allowed"
    }
    return null
  } catch {
    return "Invalid URL format"
  }
}

/** Return a provider-specific debugging hint for API errors. */
export function getProviderErrorHint(provider: AIProvider): string {
  if (provider === "custom" || provider === "zai") {
    return " Check your base URL and model name — the endpoint must be OpenAI-compatible (/chat/completions)."
  }
  return ""
}

/** Block private/reserved IP ranges and special hostnames (mirrors fetch-url SSRF protection). */
function isBlockedHost(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return true
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true
  const h = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (h === "localhost") return true
  if (h === "metadata.google.internal") return true
  if (h === "::1" || h === "0:0:0:0:0:0:0:1") return true
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 0) return true
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true
    if (a >= 224) return true
  }
  return false
}

/** @deprecated Use loadAIConfig() for direct browser → provider calls.
 *  Kept for any remaining server-route usage during transition. */
export function getAIHeaders(): Record<string, string> {
  const config = loadAIConfig()
  if (!config) return {}
  const models = getModelsForProvider(config.provider)
  const model = models.find(m => m.id === config.modelId) || AI_MODELS.find(m => m.id === DEFAULT_MODEL_ID)!
  return {
    "x-or-key": config.apiKey,
    "x-or-model": config.modelId,
    "x-or-supports-grounding": model.supportsGrounding ? "true" : "false",
  }
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(loadSettings)

  const updateSettings = useCallback((patch: Partial<AISettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const models = getModelsForProvider(settings.provider)

  const resolvedModelId = (() => {
    const model = models.find(m => m.id === settings.modelId) || models[0]
    if (!model) return settings.modelId
    if (settings.provider === "openrouter" && settings.webGrounding && model.supportsGrounding) {
      return `${model.id}:online`
    }
    return model.id
  })()

  const currentModel: AIModel = models.find(m => m.id === settings.modelId) || models[0] || {
    id: settings.modelId,
    label: settings.modelId,
    shortLabel: settings.modelId.split("/").pop() || settings.modelId,
    description: "Custom model",
    supportsGrounding: false,
  }

  return { settings, updateSettings, resolvedModelId, currentModel, models }
}
