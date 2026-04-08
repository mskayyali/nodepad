"use client"

import { useState, useEffect, useCallback } from "react"

export interface AIModel {
  id: string
  label: string
  shortLabel: string
  description: string
  supportsGrounding: boolean
  /** For OpenAI models: the search-preview variant to use when grounding is enabled */
  groundingModelId?: string
}

export type AIProvider = "openrouter" | "openai" | "zai" | "ollama" | "lmstudio"
export type LocalProvider = "ollama" | "lmstudio"

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
    baseUrl: "https://api.z.ai/api/paas/v4",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    keyPlaceholder: "Your Z.ai API key",
  },
  {
    id: "ollama",
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    keyUrl: "",
    keyPlaceholder: "No key needed (leave as-is)",
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    keyUrl: "",
    keyPlaceholder: "No key needed (leave as-is)",
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
    supportsGrounding: true,
    groundingModelId: "gpt-4o-search-preview",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    shortLabel: "GPT-4o Mini",
    description: "Fast and capable, web grounding available",
    supportsGrounding: true,
    groundingModelId: "gpt-4o-mini-search-preview",
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

export const ZAI_MODELS: AIModel[] = [
  {
    id: "glm-4.5",
    label: "GLM-4.5",
    shortLabel: "GLM-4.5",
    description: "Fast, cost-efficient Z.ai model",
    supportsGrounding: false,
  },
  {
    id: "glm-4.7",
    label: "GLM-4.7",
    shortLabel: "GLM-4.7",
    description: "Strong reasoning, 200K context",
    supportsGrounding: false,
  },
  {
    id: "glm-5",
    label: "GLM-5",
    shortLabel: "GLM-5",
    description: "Z.ai flagship model",
    supportsGrounding: false,
  },
  {
    id: "glm-5-turbo",
    label: "GLM-5 Turbo",
    shortLabel: "GLM-5 Turbo",
    description: "Fast, capable, community tested",
    supportsGrounding: false,
  },
]

/** True when running inside a Tauri desktop shell (no Next.js server available) */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

export function getModelsForProvider(provider: AIProvider): AIModel[] {
  if (provider === "openai")   return OPENAI_MODELS
  if (provider === "zai")      return ZAI_MODELS
  // Local providers return [] — models are fetched dynamically via fetchLocalModels()
  if (provider === "ollama" || provider === "lmstudio") return []
  return AI_MODELS // openrouter + safe fallback for any stale localStorage value
}

/**
 * Fetch installed models from a local provider (Ollama or LM Studio).
 * In the browser, routes through /api/local-models to bypass CORS.
 * In Tauri, prefers /api/local-models when available (dev mode with Next)
 * and falls back to direct local calls for static desktop builds.
 */
export async function fetchLocalModels(
  provider: AIProvider,
  customBaseUrl?: string,
): Promise<AIModel[]> {
  try {
    if (provider !== "ollama" && provider !== "lmstudio") return []

    let data: Record<string, unknown>
    const trimmedBaseUrl = customBaseUrl?.trim()
    const preset = getPreset(provider)
    const baseUrl = trimmedBaseUrl || preset.baseUrl
    const serverRoot = baseUrl.replace(/\/v1\/?$/, "").replace(/\/$/, "")

    const readErrorMessage = async (res: Response): Promise<string> => {
      const fallback = `Local model fetch failed (${res.status})`
      try {
        const contentType = res.headers.get("content-type") || ""
        if (contentType.includes("application/json")) {
          const payload = await res.json() as { error?: unknown; message?: unknown }
          const message =
            typeof payload.error === "string" ? payload.error
              : typeof payload.message === "string" ? payload.message
              : ""
          if (message.trim()) return `${message} (status ${res.status})`
        }

        const text = (await res.text()).trim()
        if (text) return `${text} (status ${res.status})`
      } catch {
        // Fall through to generic message.
      }
      return fallback
    }

    const fetchDirect = async (): Promise<Record<string, unknown>> => {
      if (provider === "ollama") {
        const res = await fetch(`${serverRoot}/api/tags`, { signal: AbortSignal.timeout(5000) })
        if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
        return await res.json()
      }
      const res = await fetch(`${serverRoot}/v1/models`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) throw new Error(`LM Studio returned ${res.status}`)
      return await res.json()
    }

    const fetchProxy = async () =>
      fetch("/api/local-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, baseUrl: trimmedBaseUrl }),
        signal: AbortSignal.timeout(6000),
      })

    if (isTauri()) {
      // Tauri dev has Next.js API routes; static desktop build does not.
      // Prefer proxy when present, then fall back to direct local fetch.
      try {
        const proxyRes = await fetchProxy()
        if (proxyRes.ok) {
          data = await proxyRes.json()
        } else if (proxyRes.status === 403 || proxyRes.status === 404 || proxyRes.status === 405) {
          data = await fetchDirect()
        } else {
          throw new Error(await readErrorMessage(proxyRes))
        }
      } catch {
        data = await fetchDirect()
      }
    } else {
      // Browser web app: always proxy through Next.js to avoid CORS issues.
      const res = await fetchProxy()
      if (!res.ok) throw new Error(await readErrorMessage(res))
      data = await res.json()
    }

    if (provider === "ollama") {
      const models = ((data as { models?: unknown[] }).models ?? []) as Array<{ name: string; details?: { parameter_size?: string; family?: string } }>
      return models.map(m => ({
        id: m.name,
        label: m.name,
        shortLabel: m.name.split(":")[0],
        description: m.details?.parameter_size
          ? `${m.details.parameter_size}${m.details.family ? ` · ${m.details.family}` : ""}`
          : "Local model",
        supportsGrounding: false,
      }))
    }

    // LM Studio (OpenAI-compatible format)
    const models = ((data as { data?: unknown[] }).data ?? []) as Array<{ id: string }>
    return models.map(m => ({
      id: m.id,
      label: m.id,
      shortLabel: m.id.split("/").pop() || m.id,
      description: "Local model",
      supportsGrounding: false,
    }))
  } catch (err) {
    throw (err instanceof Error ? err : new Error("Could not fetch local models"))
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
  /** Per-provider key store so switching back to a provider restores its key */
  providerKeys?: Partial<Record<AIProvider, string>>
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

const LOCAL_PROVIDERS = new Set<AIProvider>(["ollama", "lmstudio"])

export function isLocalProvider(provider: AIProvider): provider is LocalProvider {
  return LOCAL_PROVIDERS.has(provider)
}

export function loadAIConfig(): AIConfig | null {
  const s = loadSettings()
  // Local providers don't need an API key
  if (!s.apiKey && !isLocalProvider(s.provider)) return null
  const models = getModelsForProvider(s.provider)
  const model = models.find(m => m.id === s.modelId)
  const modelId = model?.id ?? models[0]?.id ?? s.modelId ?? DEFAULT_MODEL_ID
  const supportsGrounding =
    (s.provider === "openrouter" || s.provider === "openai") &&
    s.webGrounding &&
    (model?.supportsGrounding ?? false)
  return { apiKey: s.apiKey, modelId, supportsGrounding, provider: s.provider, customBaseUrl: s.customBaseUrl }
}

export function getBaseUrl(config: AIConfig): string {
  // Prefer user-supplied custom URL (e.g. different port for Ollama/LM Studio)
  const custom = config.customBaseUrl?.trim()
  if (custom) return custom
  return getPreset(config.provider).baseUrl
}

export function getProviderHeaders(config: AIConfig): Record<string, string> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
  }
  // Local providers don't need auth; Ollama ignores it, LM Studio accepts a dummy key
  if (!isLocalProvider(config.provider)) {
    base["Authorization"] = `Bearer ${config.apiKey}`
  }
  if (config.provider === "openrouter") {
    base["HTTP-Referer"] = "https://nodepad.space"
    base["X-Title"] = "nodepad"
  }
  return base
}

/**
 * Route chat-completions to the correct transport for each runtime.
 * - Cloud providers: direct call to provider base URL.
 * - Local providers in browser: /api/local-chat proxy (CORS-safe).
 * - Local providers in Tauri: prefer proxy in dev, fallback to direct local call.
 */
export async function requestChatCompletion(
  config: AIConfig,
  chatBody: Record<string, unknown>,
): Promise<Response> {
  const baseUrl = getBaseUrl(config)

  const requestDirect = () =>
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: getProviderHeaders(config),
      body: JSON.stringify(chatBody),
      signal: isLocalProvider(config.provider) ? AbortSignal.timeout(120_000) : undefined,
    })

  if (!isLocalProvider(config.provider)) {
    return requestDirect()
  }

  const requestViaProxy = () =>
    fetch("/api/local-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: config.provider,
        baseUrl: config.customBaseUrl?.trim() || undefined,
        body: chatBody,
      }),
      signal: AbortSignal.timeout(120_000),
    })

  if (isTauri()) {
    // Tauri dev can use the Next.js proxy route; static desktop builds cannot.
    // Also fallback when proxy rejects a custom local port (403) in dev.
    try {
      const proxyRes = await requestViaProxy()
      if (proxyRes.status === 403 || proxyRes.status === 404 || proxyRes.status === 405) {
        return requestDirect()
      }
      return proxyRes
    } catch {
      return requestDirect()
    }
  }

  return requestViaProxy()
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
  // Always start with the SSR-safe default so server and client render identically.
  // Load the real localStorage value after mount to avoid hydration mismatches
  // caused by settings.apiKey toggling conditional DOM blocks (API key banner,
  // modelLabel prop, etc.) between the server render and client hydration.
  const [settings, setSettings] = useState<AISettings>({
    apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false,
    provider: DEFAULT_PROVIDER, customBaseUrl: "",
  })

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

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
