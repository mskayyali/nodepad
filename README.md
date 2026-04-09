# nodepad

**A design experiment in spatial, AI-augmented thinking.**

[![Watch the intro](https://img.youtube.com/vi/nCLY7rHAjWE/maxresdefault.jpg)](https://www.youtube.com/watch?v=nCLY7rHAjWE)

*[Watch the intro →](https://www.youtube.com/watch?v=nCLY7rHAjWE)*

---

Most AI tools are built around a chat interface: you ask, it answers, you ask again. The interaction is sequential, conversational, and optimised for producing output. nodepad is built around a different premise: that thinking is spatial and associative, and that AI is most useful when it works quietly in the background rather than at the centre of attention.

You add notes. The AI classifies them, finds connections between them, surfaces what you haven't said yet, and occasionally synthesises an emergent insight from the whole canvas. You stay in control of the space. The AI earns its place by being genuinely useful rather than prominent.

---

## How it works

Notes are typed into the input bar and placed onto a spatial canvas. Each note is automatically classified into one of 14 types — claim, question, idea, task, entity, quote, reference, definition, opinion, reflection, narrative, comparison, thesis, general — and enriched with a short annotation that adds something the note doesn't already say.

Connections between notes are inferred from content. When you hover a connection indicator, unrelated notes dim. When enough notes accumulate, a synthesis emerges — a single sentence that bridges the tensions across the canvas. You can solidify it into a thesis note or dismiss it.

Three views: **tiling** (spatial BSP grid), **kanban** (grouped by type), **graph** (force-directed, centrality-radial).

---

## Setup

**Requirements**: a desktop browser and either an API key from a supported provider, or a local [Ollama](https://ollama.com) installation.

```bash
git clone https://github.com/mskayyali/nodepad.git
cd nodepad
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

**Add your API key**: click the menu icon (top-left) → Settings → choose your provider → paste your key. The key is stored in your browser's `localStorage` and goes directly to the AI provider — it never passes through any server. If using **Ollama**, no key is needed — just select the provider and pick a model.

**Enable web grounding** (optional): toggle "Web grounding" in Settings to let the AI cite real sources for claims, questions, and references. Supported on OpenRouter `:online` models and OpenAI search-preview models.

---

## Providers & Models

Select provider and model from the sidebar Settings panel. Each provider remembers its key independently — switching providers and back restores your key.

### OpenRouter *(default)*
Access to all major models through a single key. Free credits available at [openrouter.ai](https://openrouter.ai).

| Model | Notes |
|---|---|
| `openai/gpt-4o` | Default. Strong annotation quality, web grounding. |
| `anthropic/claude-sonnet-4-5` | Strong reasoning, complex research. |
| `google/gemini-2.5-pro` | Long context, web grounding. |
| `deepseek/deepseek-chat` | Fast, cost-effective. |
| `mistralai/mistral-small-3.2` | Lightweight, fast. |

### OpenAI *(direct)*
Use your OpenAI API key directly. Web grounding via search-preview models.

| Model | Notes |
|---|---|
| `gpt-4o` | Strong structured output, web grounding. |
| `gpt-4o-mini` | Fast, capable, web grounding. |
| `gpt-4.1` | Latest GPT-4, improved instruction following. |
| `o4-mini` | Fast reasoning model. |

### Z.ai
GLM models from Zhipu AI. Get a key at [z.ai](https://z.ai/manage-apikey/apikey-list).

| Model | Notes |
|---|---|
| `glm-4.7` | Strong reasoning, 200K context. |
| `glm-5` | Z.ai flagship model. |
| `glm-5-turbo` | Fast, community-tested. |

### Ollama (Local)
Run models locally with [Ollama](https://ollama.com) — no API key, no cost, no data leaves your machine.

1. [Install Ollama](https://ollama.com/download) and pull a model (e.g. `ollama pull llama3`).
2. Make sure Ollama is running (`ollama serve` or the desktop app).
3. In nodepad, select **Ollama (Local)** as the provider. Available models are detected automatically.

All requests are proxied through the Next.js server so there are no CORS issues when accessing nodepad from a LAN IP.

> **Note:** Ollama models don't support web grounding. JSON structured output quality varies by model — larger models (7B+) generally produce better annotations.

---

## Synthesis

The Synthesis panel (sparkles icon in the status bar, or via `Cmd+K → Synthesis`) surfaces emergent theses — cross-category insights the AI infers from the tensions between your notes.

**Automatic generation** triggers after enrichment when enough material accumulates (5+ enriched blocks, 2+ categories, 5-minute cooldown between generations).

**Manual generation** — click the **Generate** button in the Synthesis panel at any time. Manual generation skips the cooldown and block-count throttles, requiring only 2+ enriched blocks across 2+ categories.

**Guiding Thoughts** — enable the checkbox in the Synthesis panel footer to steer generation. Write a direction (e.g. *"Focus on tensions between technology and human agency"*) and the AI will honor it while still finding non-obvious cross-category bridges.

Claim a thesis to add it to the canvas, or dismiss it. Up to 5 theses can be queued at once.

---

## Keyboard shortcuts

| | |
|---|---|
| `Enter` | Add note |
| `⌘K` | Command palette (views, navigation, export) |
| `⌘Z` | Undo |
| `Escape` | Deselect / close panels |

Double-click any note to edit. Click the type label to reclassify manually.

---

## Data

Everything lives in your browser. No account, no server, no database.

- Notes are persisted to `localStorage` under `nodepad-projects`
- A silent rolling backup is written on every change to `nodepad-backup`
- Export to `.md` or `.nodepad` (versioned JSON) via `⌘K`
- Import `.nodepad` files via the sidebar
- **Auto-save**: when exporting a `.nodepad` file on a supported browser (Chrome/Edge over HTTPS), the app uses the File System Access API to keep a handle to the file. New entries, claimed syntheses, and completed enrichments are automatically saved to the same file — no re-exporting needed. A small icon appears next to the project name in the status bar when auto-save is active.

---

## Tech

Next.js · React 19 · TypeScript · Tailwind CSS v4 · D3.js · Framer Motion

---

## Contributing

Pull requests welcome. Two PRs have already shaped the project:

- **PR #1** by [@matwate](https://github.com/matwate) — OpenAI provider support, multi-provider architecture
- **PR #2** by [@desireco](https://github.com/desireco) — Z.ai provider, robust JSON parsing for truncated responses

---

## Fork changes

This fork adds the following features on top of the [original nodepad](https://github.com/mskayyali/nodepad):

- **Ollama (local AI)** — run models locally with zero cost and full privacy. Models are auto-detected from the running Ollama instance, proxied through the Next.js server to avoid CORS issues on LAN access.
- **Manual synthesis generation** — trigger Emergent Thesis generation on demand via the Synthesis panel, without waiting for automatic cooldowns.
- **Guiding Thoughts** — steer synthesis generation with a user-provided direction while preserving cross-category bridging.
- **Auto-save to disk** — export once via the save picker, then every new entry, claimed synthesis, and enrichment completion auto-saves to the same `.nodepad` file.
- **LAN dev access** — `allowedDevOrigins` configured for local network development.

---

Original design experiment by [Saleh Kayyali](http://mskayyali.com).

---

## License

[MIT](LICENSE)
