# nodepad

**A design experiment in spatial, AI-augmented thinking.**

[![Watch the intro](https://img.youtube.com/vi/jZu4sgZOOO4/maxresdefault.jpg)](https://www.youtube.com/watch?v=jZu4sgZOOO4)

*[Watch the intro →](https://www.youtube.com/watch?v=jZu4sgZOOO4)*

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

**Requirements**: a desktop browser and an API key from one of the supported providers.

```bash
git clone https://github.com/mskayyali/nodepad.git
cd nodepad
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

**Add your API key**: click the menu icon (top-left) → Settings → choose your provider → paste your key. The key is stored in your browser's `localStorage` and goes directly to the AI provider — it never passes through any server.

**Enable web grounding** (optional): toggle "Web grounding" in Settings to let the AI cite real sources for claims, questions, and references. Supported on OpenRouter `:online` models and OpenAI search-preview models.

### Running local models

nodepad can run AI entirely on your machine via the [Claude CLI](https://docs.anthropic.com/en/docs/claude-code/overview), with no API key required. Because this spawns a local process, it must be explicitly enabled at startup.

**Prerequisites**: install and authenticate the Claude CLI.

```bash
npm install -g @anthropic-ai/claude-code
claude  # follow the login prompt
```

**Dev mode with local models:**

```bash
npm run dev:with-local-models
```

Once running, open Settings in the sidebar and select **Claude CLI** as the provider. No API key is needed — it uses the authenticated CLI on your machine.

> Local model support is disabled in standard `dev` / `build` / `start` scripts. The `claude-cli` provider will not appear in the Settings panel, and the `/api/claude-cli` endpoint will return `403` unless the app was started with the `:with-local-models` variant.

---

## Providers & Models

Select provider and model from the sidebar Settings panel. Each provider remembers its key independently — switching providers and back restores your key. Once a key is entered, the model picker fetches all models available on your account and lets you search and select any of them — not just the presets listed below.

**Custom base URL**: override the provider endpoint in Settings to use local or self-hosted models (Ollama, LM Studio, vLLM, or any OpenAI-compatible API).

### OpenRouter *(default)*
Access to all major models through a single key. Create a free account at [openrouter.ai](https://openrouter.ai) — use the free-tier models below with no credits, or add credits for GPT-4o, Claude, and Gemini.

| Model | Notes |
|---|---|
| `openai/gpt-4o` | Default. Strong annotation quality, web grounding. |
| `anthropic/claude-sonnet-4-5` | Strong reasoning, complex research. |
| `google/gemini-2.5-pro` | Long context, web grounding. |
| `deepseek/deepseek-chat` | Fast, cost-effective. |
| `mistralai/mistral-small-3.2` | Lightweight, fast. |

**Free tier** — no credits required, ~200 req/day limit, Nvidia-hosted, no web grounding:

| Model | Notes |
|---|---|
| `nvidia/nemotron-3-nano-30b-a3b:free` | Nemotron 30B — fast, reliable. |
| `nvidia/nemotron-3-super-120b-a12b:free` | Nemotron 120B MoE — higher quality, same speed. |

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

### Claude CLI *(local)*
Runs Claude entirely on your machine — no API key, no direct API calls to an AI provider. Requires the app to be started with `npm run dev:with-local-models` (see [Running local models](#running-local-models)).

| Model | Notes |
|---|---|
| `claude-sonnet-4-6` | Best balance of speed and quality. |
| `claude-opus-4-6` | Most capable Claude model. |
| `claude-haiku-4-5` | Fast and lightweight. |

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

---

## Tech

Next.js · React 19 · TypeScript · Tailwind CSS v4 · D3.js · Framer Motion

---

## Contributing

Pull requests are welcome. I go through them regularly. Some will be merged, others may stay open.

---

A design experiment by [Saleh Kayyali](http://mskayyali.com).

---

## License

[MIT](LICENSE)
