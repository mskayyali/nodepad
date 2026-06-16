/**
 * Local model providers — these run on the user's machine rather than via a
 * cloud API key. Adding a new local provider only requires:
 *  1. Appending its id to LOCAL_PROVIDER_IDS
 *  2. Adding the preset to AI_PROVIDER_PRESETS in lib/ai-settings.ts
 *  3. Creating the connector under app/api/<provider-id>/
 */
export const LOCAL_PROVIDER_IDS = ["claude-cli"] as const

export type LocalProvider = (typeof LOCAL_PROVIDER_IDS)[number]

export function isLocalProvider(provider: string): provider is LocalProvider {
  return (LOCAL_PROVIDER_IDS as readonly string[]).includes(provider)
}

/**
 * True when the app was started/built with `WITH_LOCAL_MODELS=true`.
 * Controls both the client-side provider list and the server-side API guard.
 */
export const WITH_LOCAL_MODELS =
  process.env.NEXT_PUBLIC_WITH_LOCAL_MODELS === "true"
