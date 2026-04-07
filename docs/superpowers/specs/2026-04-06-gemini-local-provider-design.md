# Gemini (Local) Provider — Design Spec

**Date:** 2026-04-06
**Status:** Approved
**Approach:** Adapter layer (Option A) — minimal changes, Gemini logic isolated in its own module

---

## Overview

Add a "Gemini (Local)" provider to nodepad that uses Gemini CLI's locally stored OAuth tokens to call Google's CodeAssist API. This lets users leverage their existing Google One AI Ultra (or Gemini Code Assist) subscription at zero additional cost, with no API keys required.

## How It Works

Gemini CLI stores OAuth credentials at `~/.gemini/oauth_creds.json`. The user copies this file to `./gemini-creds.json` in the repo root (gitignored). The app reads the refresh token from this file, exchanges it for short-lived access tokens, and calls Google's CodeAssist API (`cloudcode-pa.googleapis.com/v1internal`) — the same endpoint Gemini CLI uses internally.

## Architecture

### New Files

1. **`lib/gemini-local.ts`** — All Gemini-specific logic:
   - `loadGeminiCreds()` — reads `gemini-creds.json`, returns `{access_token, refresh_token, expiry_date}` or `null`
   - `refreshAccessToken(refreshToken)` — POSTs to `oauth2.googleapis.com/token` with Gemini CLI's public client ID and secret (loaded from `.env.local`). Returns fresh access token + expiry.
   - `getValidAccessToken()` — returns cached token if not expired (60s buffer), otherwise refreshes. Deduplicates concurrent refresh requests via shared promise.
   - `discoverProject()` — calls `loadCodeAssist` endpoint once per session, caches the managed project ID.
   - `geminiGenerateContent(model, messages, generationConfig?)` — translates from `{role, content}` messages to CodeAssist's `{model, project, request: {contents, generationConfig}}` format. Returns parsed text content from first candidate.

2. **`app/api/gemini-local/status/route.ts`** — `GET` endpoint. Checks if `gemini-creds.json` exists at repo root and has a valid refresh token. Returns `{ configured: boolean, error?: string }`.

3. **`app/api/gemini-local/refresh/route.ts`** — `POST` endpoint. Reads refresh token from `gemini-creds.json`, exchanges for access token via Google OAuth. Returns `{ access_token, expiry_date }`. Solves CORS (browser can't POST to `oauth2.googleapis.com` directly).

4. **`docs/gemini-local-setup.md`** — Setup instructions for users.

5. **`gemini-creds.json`** — Copied by user from `~/.gemini/oauth_creds.json`. Added to `.gitignore`.

### Modified Files

6. **`lib/ai-settings.ts`**:
   - `AIProvider` type: add `"gemini-local"` to union
   - `AI_PROVIDER_PRESETS`: add entry with `id: "gemini-local"`, `label: "Gemini (Local)"`, empty `baseUrl`/`keyUrl`/`keyPlaceholder`
   - `GEMINI_LOCAL_MODELS` array (6 models, see below)
   - `getModelsForProvider()`: add `gemini-local` branch
   - `loadAIConfig()`: for `gemini-local`, `apiKey` is irrelevant; validity determined by credential file
   - `getProviderHeaders()` / `getBaseUrl()`: return empty/placeholder for `gemini-local` (unused)

7. **`lib/ai-enrich.ts`**:
   - In `enrichBlockClient()`, after `loadAIConfig()`: if `provider === "gemini-local"`, call `geminiGenerateContent()` instead of raw `fetch`
   - Pass system prompt, user message, generationConfig with `responseMimeType: "application/json"` and `responseSchema`
   - Web grounding always disabled for `gemini-local`
   - Parse response text as JSON using existing parsing logic

8. **`lib/ai-ghost.ts`**:
   - In `generateGhostClient()`: if `provider === "gemini-local"`, call `geminiGenerateContent()` with synthesis prompt
   - Pass `temperature: 0.7`, `responseMimeType: "application/json"`

9. **`components/project-sidebar.tsx`**:
   - When `gemini-local` selected: hide API key input, hide web grounding toggle
   - Status indicator: call `/api/gemini-local/status` to check if credentials are present
   - If not configured: show "Credentials not found" with link to `docs/gemini-local-setup.md` instructions
   - Model dropdown: populated from `GEMINI_LOCAL_MODELS`, works identically to other providers
   - Save button: only persists `provider` and `modelId` (no key)

10. **`next.config.mjs`**:
    - Add `https://cloudcode-pa.googleapis.com` to CSP `connect-src` directive

11. **`.gitignore`**:
    - Add `gemini-creds.json`

## Models

| ID | Label | Description |
|---|---|---|
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro | Latest, most capable (preview) |
| `gemini-3-pro-preview` | Gemini 3 Pro | Strong reasoning (preview) |
| `gemini-3-flash-preview` | Gemini 3 Flash | Fast Gemini 3 (preview) |
| `gemini-2.5-pro` | Gemini 2.5 Pro | Stable, best reasoning |
| `gemini-2.5-flash` | Gemini 2.5 Flash | Fast, great balance **(default)** |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite | Fastest, lightweight |

All verified working via the CodeAssist API on 2026-04-06.

## CodeAssist API Details

- **Endpoint:** `https://cloudcode-pa.googleapis.com/v1internal`
- **Auth:** `Authorization: Bearer <access_token>`
- **Project discovery:** POST to `:loadCodeAssist` with metadata `{ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI"}`. Returns `cloudaicompanionProject` field.
- **Generate:** POST to `:generateContent` with body:
  ```json
  {
    "model": "<model-id>",
    "project": "<managed-project-id>",
    "request": {
      "contents": [{"role": "user", "parts": [{"text": "..."}]}],
      "systemInstruction": {"role": "user", "parts": [{"text": "..."}]},
      "generationConfig": {
        "temperature": 0.1,
        "responseMimeType": "application/json"
      }
    }
  }
  ```
- **Response shape:** `{ response: { candidates: [{ content: { parts: [{ text }] } }] } }`

## Token Management

- Access tokens expire in ~1 hour. Auto-refresh using stored refresh token with 60-second buffer before expiry.
- Concurrent refresh requests deduplicated via shared in-flight promise.
- Refresh happens server-side (via `/api/gemini-local/refresh`) to avoid CORS issues with `oauth2.googleapis.com`.
- Project ID discovered once per session via `loadCodeAssist`, cached in memory.
- Token state cached in the `gemini-local.ts` module — not persisted back to `gemini-creds.json` (avoids write conflicts with Gemini CLI).

## Error Handling

| Scenario | Behavior |
|---|---|
| `gemini-creds.json` missing | Settings: "Credentials not found" + link to setup instructions. Toast on API call attempt. |
| File malformed / no refresh token | Settings: "Invalid credentials file" + link to setup instructions |
| Refresh token revoked / expired | Toast: "Gemini token expired — run `gemini auth login` to re-authenticate" |
| Access token refresh network failure | Retry once, then toast with error |
| `loadCodeAssist` returns no project | Toast: "Account not eligible for Gemini Code Assist" |
| `generateContent` API error | Toast with error message (same as existing provider error path) |
| Concurrent refresh requests | Deduplicated — second caller awaits first caller's promise |

## Constraints

- **Local only** — credential file is on disk, so this provider only works in local dev (`npm run dev`). Not usable when deployed to Vercel/etc.
- **No web grounding** — CodeAssist API doesn't support `:online` suffix or `web_search_options`.
- **Piggybacks on Gemini CLI's OAuth client** — uses the CLI's public client ID/secret for token refresh. Fine for personal use.
- **Preview models may change** — Gemini 3.x model IDs include `-preview` suffix and may be renamed/removed by Google.

## CSP Changes

Add to `connect-src` in `next.config.mjs`:
```
https://cloudcode-pa.googleapis.com
```

## Out of Scope

- Claude provider integration (deferred to a later session)
- Google OAuth login flow in-app (we reuse Gemini CLI's tokens instead)
- Syncing token changes back to `~/.gemini/oauth_creds.json`
- Streaming responses (current app doesn't stream for any provider)
