# Gemini (Local) Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Gemini (Local)" provider that uses Gemini CLI's OAuth tokens to call Google's CodeAssist API at zero cost.

**Architecture:** New `lib/gemini-local.ts` module handles all Gemini-specific logic (token refresh, project discovery, request/response translation). Two Next.js API routes handle server-side token operations. Existing `ai-enrich.ts` and `ai-ghost.ts` branch on `provider === "gemini-local"` to route through this module. Settings UI hides API key input for this provider and shows credential status.

**Tech Stack:** Next.js API routes, Google OAuth2 token refresh, CodeAssist API (`cloudcode-pa.googleapis.com/v1internal`)

**Spec:** `docs/superpowers/specs/2026-04-06-gemini-local-provider-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/gemini-local.ts` | Token management, project discovery, CodeAssist API adapter |
| Create | `app/api/gemini-local/status/route.ts` | Check if `gemini-creds.json` exists and is valid |
| Create | `app/api/gemini-local/refresh/route.ts` | Exchange refresh token for access token (server-side to avoid CORS) |
| Create | `docs/gemini-local-setup.md` | User-facing setup instructions |
| Modify | `lib/ai-settings.ts` | Add `gemini-local` provider type, presets, model list |
| Modify | `lib/ai-enrich.ts` | Branch to `geminiGenerateContent()` when provider is `gemini-local` |
| Modify | `lib/ai-ghost.ts` | Branch to `geminiGenerateContent()` when provider is `gemini-local` |
| Modify | `components/project-sidebar.tsx` | Hide API key for `gemini-local`, show credential status |
| Modify | `next.config.mjs` | Add `https://cloudcode-pa.googleapis.com` to CSP `connect-src` |
| Modify | `.gitignore` | Add `gemini-creds.json` |
| Create | `gemini-creds.json` | Copy of `~/.gemini/oauth_creds.json` (gitignored) |

---

### Task 1: Scaffold — gitignore, credential file, setup docs

**Files:**
- Modify: `.gitignore`
- Create: `gemini-creds.json` (copied from `~/.gemini/oauth_creds.json`)
- Create: `docs/gemini-local-setup.md`

- [ ] **Step 1: Add `gemini-creds.json` to `.gitignore`**

Append to `.gitignore`:

```
# Gemini (Local) provider credentials — never commit
gemini-creds.json
```

- [ ] **Step 2: Copy the credential file**

```bash
cp ~/.gemini/oauth_creds.json ./gemini-creds.json
```

- [ ] **Step 3: Create setup instructions**

Create `docs/gemini-local-setup.md` with:

```markdown
# Gemini (Local) Provider Setup

The **Gemini (Local)** provider lets you use your existing Gemini CLI OAuth tokens to access Google's Gemini models at no additional cost. This works with Google One AI Ultra and Gemini Code Assist subscriptions.

## Prerequisites

1. Install [Gemini CLI](https://github.com/google-gemini/gemini-cli):
   ```bash
   npm install -g @google/gemini-cli
   ```

2. Authenticate with your Google account:
   ```bash
   gemini auth login
   ```

## Setup

Copy the Gemini CLI credential file into the nodepad project root:

```bash
cp ~/.gemini/oauth_creds.json ./gemini-creds.json
```

The file is already in `.gitignore` and will never be committed.

### Default credential location on macOS

```
~/.gemini/oauth_creds.json
```

## Usage

1. Open nodepad (`npm run dev`)
2. Open the sidebar (menu button, top-left) → **Settings**
3. Select **Gemini (Local)** as the provider
4. Choose a model and save

## Troubleshooting

- **"Credentials not found"** — Run `cp ~/.gemini/oauth_creds.json ./gemini-creds.json` from the project root.
- **"Token expired"** — Run `gemini auth login` in your terminal, then re-copy the credential file.
- **"Account not eligible"** — Your Google account may not have an active Gemini Code Assist or Google One AI Ultra subscription.
```

- [ ] **Step 4: Verify gitignore works**

```bash
git status
```

Expected: `gemini-creds.json` should NOT appear in untracked files. `docs/gemini-local-setup.md` and `.gitignore` should appear.

- [ ] **Step 5: Commit**

```bash
git add .gitignore docs/gemini-local-setup.md
git commit -m "chore: add gitignore entry and setup docs for Gemini (Local) provider"
```

---

### Task 2: API routes — status check and token refresh

**Files:**
- Create: `app/api/gemini-local/status/route.ts`
- Create: `app/api/gemini-local/refresh/route.ts`

- [ ] **Step 1: Create the status route**

Create `app/api/gemini-local/status/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

const CREDS_PATH = join(process.cwd(), "gemini-creds.json")

export async function GET() {
  try {
    if (!existsSync(CREDS_PATH)) {
      return NextResponse.json({ configured: false, error: "Credentials file not found. See docs/gemini-local-setup.md" })
    }
    const raw = readFileSync(CREDS_PATH, "utf-8")
    const creds = JSON.parse(raw)
    if (!creds.refresh_token) {
      return NextResponse.json({ configured: false, error: "Credentials file is missing refresh_token" })
    }
    return NextResponse.json({ configured: true })
  } catch {
    return NextResponse.json({ configured: false, error: "Failed to read credentials file" })
  }
}
```

- [ ] **Step 2: Create the refresh route**

Create `app/api/gemini-local/refresh/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { existsSync, readFileSync } from "fs"
import { join } from "path"

const CREDS_PATH = join(process.cwd(), "gemini-creds.json")

// Gemini CLI's public OAuth client credentials (embedded in the open-source CLI binary)
// Gemini CLI's public OAuth client credentials — loaded from .env.local
const OAUTH_CLIENT_ID = process.env.GEMINI_OAUTH_CLIENT_ID ?? ""
const OAUTH_CLIENT_SECRET = process.env.GEMINI_OAUTH_CLIENT_SECRET ?? ""

export async function POST() {
  try {
    if (!existsSync(CREDS_PATH)) {
      return NextResponse.json({ error: "Credentials file not found" }, { status: 404 })
    }

    const raw = readFileSync(CREDS_PATH, "utf-8")
    const creds = JSON.parse(raw)
    if (!creds.refresh_token) {
      return NextResponse.json({ error: "No refresh_token in credentials file" }, { status: 400 })
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: creds.refresh_token,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json(
        { error: `Token refresh failed: ${err}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json({
      access_token: data.access_token,
      expiry_date: Date.now() + (data.expires_in ?? 3599) * 1000,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Refresh failed" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Test the status route**

```bash
curl -s http://localhost:3000/api/gemini-local/status | python3 -m json.tool
```

Expected: `{ "configured": true }`

- [ ] **Step 4: Test the refresh route**

```bash
curl -s -X POST http://localhost:3000/api/gemini-local/refresh | python3 -m json.tool
```

Expected: `{ "access_token": "ya29.a0...", "expiry_date": 17... }`

- [ ] **Step 5: Commit**

```bash
git add app/api/gemini-local/
git commit -m "feat: add API routes for Gemini (Local) credential status and token refresh"
```

---

### Task 3: Core module — `lib/gemini-local.ts`

**Files:**
- Create: `lib/gemini-local.ts`

- [ ] **Step 1: Create the Gemini local module**

Create `lib/gemini-local.ts`:

```typescript
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

  const res = await fetch(`${CODE_ASSIST_ENDPOINT}:generateContent`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      project: projectId,
      request: {
        contents,
        ...(systemInstruction && { systemInstruction }),
        ...(generationConfig && { generationConfig }),
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()

    // If token expired mid-request, clear cache so next call refreshes
    if (res.status === 401) {
      cachedAccessToken = null
      cachedExpiryDate = 0
    }

    throw new Error(`Gemini API error (${res.status}): ${err}`)
  }

  const data = await res.json()
  const text = data.response?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error("No content in Gemini response")
  }
  return text
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
```

- [ ] **Step 2: Verify the module compiles**

```bash
npx tsc --noEmit lib/gemini-local.ts 2>&1 | head -20
```

Expected: No errors (or only pre-existing project-wide errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add lib/gemini-local.ts
git commit -m "feat: add gemini-local module with token management, project discovery, and CodeAssist adapter"
```

---

### Task 4: Register the provider in `ai-settings.ts`

**Files:**
- Modify: `lib/ai-settings.ts`

- [ ] **Step 1: Add `gemini-local` to the `AIProvider` type**

In `lib/ai-settings.ts`, line 15, change:

```typescript
export type AIProvider = "openrouter" | "openai"
```

to:

```typescript
export type AIProvider = "openrouter" | "openai" | "gemini-local"
```

- [ ] **Step 2: Add the provider preset**

In `lib/ai-settings.ts`, after the OpenAI preset (after line 39, before the closing `]`), add:

```typescript
  {
    id: "gemini-local",
    label: "Gemini (Local)",
    baseUrl: "",
    keyUrl: "",
    keyPlaceholder: "",
  },
```

- [ ] **Step 3: Add the Gemini local model list**

In `lib/ai-settings.ts`, after the `OPENAI_MODELS` array (after line 122), add:

```typescript
export const GEMINI_LOCAL_MODELS: AIModel[] = [
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    shortLabel: "G-3.1 Pro",
    description: "Latest, most capable (preview)",
    supportsGrounding: false,
  },
  {
    id: "gemini-3-pro-preview",
    label: "Gemini 3 Pro",
    shortLabel: "G-3 Pro",
    description: "Strong reasoning (preview)",
    supportsGrounding: false,
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    shortLabel: "G-3 Flash",
    description: "Fast Gemini 3 (preview)",
    supportsGrounding: false,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    shortLabel: "G-2.5 Pro",
    description: "Stable, best reasoning",
    supportsGrounding: false,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    shortLabel: "G-2.5 Flash",
    description: "Fast, great balance",
    supportsGrounding: false,
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    shortLabel: "G-2.5 Lite",
    description: "Fastest, lightweight",
    supportsGrounding: false,
  },
]
```

- [ ] **Step 4: Update `getModelsForProvider()`**

In `lib/ai-settings.ts`, change `getModelsForProvider` (lines 124-127) from:

```typescript
export function getModelsForProvider(provider: AIProvider): AIModel[] {
  if (provider === "openai") return OPENAI_MODELS
  return AI_MODELS // openrouter + safe fallback for any stale localStorage value
}
```

to:

```typescript
export function getModelsForProvider(provider: AIProvider): AIModel[] {
  if (provider === "openai") return OPENAI_MODELS
  if (provider === "gemini-local") return GEMINI_LOCAL_MODELS
  return AI_MODELS // openrouter + safe fallback for any stale localStorage value
}
```

- [ ] **Step 5: Update `loadAIConfig()` to handle gemini-local**

In `lib/ai-settings.ts`, change the `supportsGrounding` logic in `loadAIConfig()` (lines 175-178) from:

```typescript
  const supportsGrounding =
    (s.provider === "openrouter" || s.provider === "openai") &&
    s.webGrounding &&
    (model?.supportsGrounding ?? false)
```

to:

```typescript
  const supportsGrounding =
    s.provider !== "gemini-local" &&
    (s.provider === "openrouter" || s.provider === "openai") &&
    s.webGrounding &&
    (model?.supportsGrounding ?? false)
```

- [ ] **Step 6: Commit**

```bash
git add lib/ai-settings.ts
git commit -m "feat: register gemini-local provider with model list in ai-settings"
```

---

### Task 5: Integrate into `ai-enrich.ts`

**Files:**
- Modify: `lib/ai-enrich.ts`

- [ ] **Step 1: Add the import**

In `lib/ai-enrich.ts`, after line 4 (`import type { ContentType } from "@/lib/content-types"`), add:

```typescript
import { geminiGenerateContent } from "@/lib/gemini-local"
```

- [ ] **Step 2: Add the gemini-local branch in `enrichBlockClient()`**

In `lib/ai-enrich.ts`, the function `enrichBlockClient` currently builds the request and calls `fetch` at line 239. We need to add a branch before that fetch call.

After line 236 (the `userMessage` construction), and before line 238 (`const baseUrl = getBaseUrl(config)`), insert the following block:

```typescript
  // ── Gemini (Local) path ──────────────────────────────────────────────────
  if (config.provider === "gemini-local") {
    const geminiConfig: Record<string, unknown> = {
      temperature: 0.1,
      responseMimeType: "application/json",
    }

    const raw = await geminiGenerateContent(
      config.modelId,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      geminiConfig,
    )

    let result: EnrichResult
    try {
      result = JSON.parse(raw)
    } catch {
      const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
      if (fenceMatch) {
        result = JSON.parse(fenceMatch[1].trim())
      } else {
        throw new Error(
          `AI returned invalid JSON. Raw response: ${raw.substring(0, 200)}`
        )
      }
    }
    if (result.confidence != null) {
      result.confidence = Math.min(100, Math.max(0, Math.round(result.confidence)))
    }
    // No source citations from CodeAssist API
    return result
  }
```

- [ ] **Step 3: Verify the app compiles**

```bash
npm run build 2>&1 | tail -10
```

Expected: Build succeeds (or only pre-existing warnings).

- [ ] **Step 4: Commit**

```bash
git add lib/ai-enrich.ts
git commit -m "feat: route gemini-local provider through CodeAssist API in ai-enrich"
```

---

### Task 6: Integrate into `ai-ghost.ts`

**Files:**
- Modify: `lib/ai-ghost.ts`

- [ ] **Step 1: Add the import**

In `lib/ai-ghost.ts`, after line 3 (`import { loadAIConfig, getBaseUrl, getProviderHeaders } from "@/lib/ai-settings"`), add:

```typescript
import { geminiGenerateContent } from "@/lib/gemini-local"
```

- [ ] **Step 2: Add the gemini-local branch in `generateGhostClient()`**

In `lib/ai-ghost.ts`, after line 51 (the prompt string ending with `{"text": "...", "category": "..."}`), and before line 53 (`const baseUrl = getBaseUrl(config)`), insert:

```typescript
  // ── Gemini (Local) path ──────────────────────────────────────────────────
  if (config.provider === "gemini-local") {
    const raw = await geminiGenerateContent(
      model,
      [{ role: "user", content: prompt }],
      { temperature: 0.7, responseMimeType: "application/json" },
    )

    try {
      return JSON.parse(raw) as GhostResult
    } catch {
      const textMatch = raw.match(/"text":\s*"(.*?)"/)
      const catMatch = raw.match(/"category":\s*"(.*?)"/)
      if (textMatch) {
        return { text: textMatch[1], category: catMatch ? catMatch[1] : "thesis" }
      }
      throw new Error("Could not parse ghost response")
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add lib/ai-ghost.ts
git commit -m "feat: route gemini-local provider through CodeAssist API in ai-ghost"
```

---

### Task 7: Update settings UI in `project-sidebar.tsx`

**Files:**
- Modify: `components/project-sidebar.tsx`

- [ ] **Step 1: Add the import for `checkGeminiLocalStatus`**

In `components/project-sidebar.tsx`, update the import from `@/lib/ai-settings` (line 22-28) — no changes needed there. Add a new import after it:

```typescript
import { checkGeminiLocalStatus } from "@/lib/gemini-local"
```

- [ ] **Step 2: Add gemini-local status state and effect**

Inside the `ProjectSidebar` component, after the `draft` state declaration (line 77), add:

```typescript
  const [geminiStatus, setGeminiStatus] = useState<{ configured: boolean; error?: string }>({ configured: false })

  // Check Gemini (Local) credential status when settings panel opens or provider changes
  useEffect(() => {
    if (showSettings && draft.provider === "gemini-local") {
      checkGeminiLocalStatus().then(setGeminiStatus)
    }
  }, [showSettings, draft.provider])
```

- [ ] **Step 3: Hide API key input for gemini-local**

In `components/project-sidebar.tsx`, wrap the API Key section (lines 340-370) with a conditional. Change the API Key `<div>` to:

```typescript
                {/* API Key — hidden for gemini-local */}
                {draft.provider !== "gemini-local" && (
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      API Key
                    </label>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                      <Key className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <input
                        type="text"
                        value={draft.apiKey}
                        onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
                        placeholder={currentPreset.keyPlaceholder || "Your API key"}
                        className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                        style={showKey ? undefined : { WebkitTextSecurity: "disc" } as never}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button onClick={() => setShowKey(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </div>
                    <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                      Stored locally. Never sent to a server.{" "}
                      {currentPreset.keyUrl && (
                        <a href={currentPreset.keyUrl} target="_blank" rel="noopener noreferrer"
                          className="text-primary underline hover:brightness-125 transition-all">
                          Get a key →
                        </a>
                      )}
                    </p>
                  </div>
                )}
```

- [ ] **Step 4: Add gemini-local credential status block**

Right after the API Key conditional block (and before the Model Selector section), add:

```typescript
                {/* Gemini (Local) credential status */}
                {draft.provider === "gemini-local" && (
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      Credentials
                    </label>
                    <div className={`flex items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[9px] ${
                      geminiStatus.configured
                        ? "bg-primary/10 border border-primary/20 text-primary"
                        : "bg-red-500/10 border border-red-500/20 text-red-400"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${geminiStatus.configured ? "bg-primary animate-pulse" : "bg-red-400"}`} />
                      {geminiStatus.configured
                        ? "Gemini CLI credentials found"
                        : geminiStatus.error ?? "Credentials not found"}
                    </div>
                    {!geminiStatus.configured && (
                      <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                        Copy your Gemini CLI credentials:{" "}
                        <code className="text-foreground/60">cp ~/.gemini/oauth_creds.json ./gemini-creds.json</code>
                        {" · "}
                        <a href="https://github.com/user/nodepad/blob/main/docs/gemini-local-setup.md" target="_blank" rel="noopener noreferrer"
                          className="text-primary underline hover:brightness-125 transition-all">
                          Setup instructions →
                        </a>
                      </p>
                    )}
                  </div>
                )}
```

- [ ] **Step 5: Hide web grounding toggle for gemini-local**

In `components/project-sidebar.tsx`, the web grounding section (line 439) currently shows for `openrouter` and `openai`. Change the condition from:

```typescript
                {(draft.provider === "openrouter" || draft.provider === "openai") && selectedModel && (
```

to:

```typescript
                {draft.provider !== "gemini-local" && (draft.provider === "openrouter" || draft.provider === "openai") && selectedModel && (
```

- [ ] **Step 6: Update the API status indicator for gemini-local**

In `components/project-sidebar.tsx`, the API status indicator (lines 468-476) checks `draft.apiKey`. Update it to also handle gemini-local. Change:

```typescript
                <div className={`flex items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[9px] ${
                  draft.apiKey
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "bg-white/5 border border-white/5 text-muted-foreground"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${draft.apiKey ? "bg-primary animate-pulse" : "bg-white/30"}`} />
                  {draft.apiKey ? `${currentPreset.label} — API key configured` : "No API key — AI disabled"}
                </div>
```

to:

```typescript
                <div className={`flex items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[9px] ${
                  (draft.provider === "gemini-local" ? geminiStatus.configured : draft.apiKey)
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "bg-white/5 border border-white/5 text-muted-foreground"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${(draft.provider === "gemini-local" ? geminiStatus.configured : draft.apiKey) ? "bg-primary animate-pulse" : "bg-white/30"}`} />
                  {draft.provider === "gemini-local"
                    ? (geminiStatus.configured ? "Gemini (Local) — credentials configured" : "Gemini (Local) — credentials not found")
                    : (draft.apiKey ? `${currentPreset.label} — API key configured` : "No API key — AI disabled")}
                </div>
```

- [ ] **Step 7: Commit**

```bash
git add components/project-sidebar.tsx
git commit -m "feat: update settings UI for gemini-local provider — hide API key, show credential status"
```

---

### Task 8: Update CSP in `next.config.mjs`

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1: Add CodeAssist endpoint to CSP connect-src**

In `next.config.mjs`, line 50, change:

```javascript
              "connect-src 'self' https://openrouter.ai https://api.openai.com https://cloud.umami.is https://api-gateway.umami.dev",
```

to:

```javascript
              "connect-src 'self' https://openrouter.ai https://api.openai.com https://cloudcode-pa.googleapis.com https://cloud.umami.is https://api-gateway.umami.dev",
```

- [ ] **Step 2: Commit**

```bash
git add next.config.mjs
git commit -m "feat: add CodeAssist endpoint to CSP connect-src for Gemini (Local) provider"
```

---

### Task 9: Update error handling in `tile-card.tsx` and `page.tsx`

**Files:**
- Modify: `components/tile-card.tsx:494-500`
- Modify: `app/page.tsx:494-500`

- [ ] **Step 1: Update error detection in `page.tsx` for gemini-local**

In `app/page.tsx`, lines 494-500, the error handler checks for "No API key". Update it to also detect gemini-local credential errors. Change:

```typescript
        } catch (e: any) {
          console.error(e)
          const isNoKey = e?.message?.includes("No API key") || false
          setProjects((current: Project[]) => current.map(proj => proj.id === projectId ? {
            ...proj,
            blocks: proj.blocks.map(b => b.id === id ? { ...b, isEnriching: false, isError: true, statusText: isNoKey ? "no-api-key" : undefined } : b)
          } : proj))
        }
```

to:

```typescript
        } catch (e: any) {
          console.error(e)
          const isNoKey = e?.message?.includes("No API key") || false
          const isGeminiCreds = e?.message?.includes("Credentials file not found") || e?.message?.includes("Token refresh failed") || false
          const statusText = isNoKey ? "no-api-key" : isGeminiCreds ? "gemini-creds-missing" : undefined
          setProjects((current: Project[]) => current.map(proj => proj.id === projectId ? {
            ...proj,
            blocks: proj.blocks.map(b => b.id === id ? { ...b, isEnriching: false, isError: true, statusText } : b)
          } : proj))
        }
```

- [ ] **Step 2: Update error display in `tile-card.tsx`**

In `components/tile-card.tsx`, lines 531-537, update the error message to handle gemini-local. Change:

```typescript
                    {block.isError && (
                      <div className="mb-3 flex items-start gap-2 rounded-sm border border-red-500/20 bg-red-500/10 px-2.5 py-2">
                        <span className="mt-px font-mono text-[9px] text-red-400/80 uppercase tracking-wider leading-relaxed">
                          {block.statusText === "no-api-key"
                            ? <>AI enrichment failed — no API key. Open the <strong className="text-red-300">☰ sidebar → Settings</strong> to add your API key.</>
                            : "Enrichment failed. Double-click to retry."}
                        </span>
                      </div>
                    )}
```

to:

```typescript
                    {block.isError && (
                      <div className="mb-3 flex items-start gap-2 rounded-sm border border-red-500/20 bg-red-500/10 px-2.5 py-2">
                        <span className="mt-px font-mono text-[9px] text-red-400/80 uppercase tracking-wider leading-relaxed">
                          {block.statusText === "no-api-key"
                            ? <>AI enrichment failed — no API key. Open the <strong className="text-red-300">☰ sidebar → Settings</strong> to add your API key.</>
                            : block.statusText === "gemini-creds-missing"
                            ? <>Gemini credentials not found. Run <strong className="text-red-300">cp ~/.gemini/oauth_creds.json ./gemini-creds.json</strong> then retry.</>
                            : "Enrichment failed. Double-click to retry."}
                        </span>
                      </div>
                    )}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx components/tile-card.tsx
git commit -m "feat: add gemini-local credential error messages to tile cards"
```

---

### Task 10: End-to-end manual test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the app and switch to Gemini (Local) provider**

1. Open `http://localhost:3000`
2. Click the menu button (top-left) → Settings
3. Select "Gemini (Local)" from the provider dropdown
4. Verify: API key input is hidden
5. Verify: Credential status shows "Gemini CLI credentials found" (green)
6. Select a model (e.g. Gemini 2.5 Flash)
7. Click Save Settings

- [ ] **Step 3: Test enrichment**

1. Type a note in the input bar, e.g. "The attention mechanism in transformers is computationally quadratic"
2. Press Enter
3. Verify: Note appears, shows shimmer loading animation
4. Verify: Note gets classified (e.g. "claim") and annotated within a few seconds
5. Check browser console — no errors

- [ ] **Step 4: Test with a Gemini 3 preview model**

1. Open Settings, switch to "Gemini 3.1 Pro"
2. Save, add another note
3. Verify: Classification and annotation work correctly

- [ ] **Step 5: Test ghost/synthesis**

1. Add 5+ notes on related topics
2. Wait for the ghost synthesis to appear (emerges after ~5 notes)
3. Verify: Synthesis text appears and can be claimed or dismissed

- [ ] **Step 6: Test error state — remove credential file**

1. Rename `gemini-creds.json` to `gemini-creds.json.bak`
2. Open Settings — verify status shows "Credentials not found" with instructions
3. Try adding a note — verify the error message appears on the tile card
4. Restore: `mv gemini-creds.json.bak gemini-creds.json`

- [ ] **Step 7: Test provider switching**

1. Switch to OpenRouter provider — verify API key input reappears
2. Switch back to Gemini (Local) — verify API key input hides, credential status shows
3. Switch to OpenAI — verify everything works as before

- [ ] **Step 8: Final commit**

If any fixes were needed during testing, commit them:

```bash
git add -A
git commit -m "fix: adjustments from end-to-end testing of Gemini (Local) provider"
```
