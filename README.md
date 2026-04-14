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

**Requirements**: a desktop browser and an API key from one of the supported providers.

```bash
git clone https://github.com/mskayyali/nodepad.git
cd nodepad
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

### Run with Docker

Requires Docker and Docker Compose.

```bash
git clone https://github.com/mskayyali/nodepad.git
cd nodepad
docker compose up --build
```

Open [localhost:3000](http://localhost:3000). To run in the background use `docker compose up -d`, and `docker compose down` to stop.

The container is stateless — notes and API keys live in your browser's `localStorage`, so there is nothing to mount or back up server-side. Override the host port with `HOST_PORT=8080 docker compose up` (see `.env.example`).

Do not scale the `web` service beyond one replica: `/api/fetch-url` uses an in-process rate limiter that assumes a single instance.

**Add your API key**: click the menu icon (top-left) → Settings → choose your provider → paste your key. The key is stored in your browser's `localStorage` and goes directly to the AI provider — it never passes through any server.

**Enable web grounding** (optional): toggle "Web grounding" in Settings to let the AI cite real sources for claims, questions, and references. Supported on OpenRouter `:online` models and OpenAI search-preview models.

---

## Providers & Models

Select provider and model from the sidebar Settings panel. Each provider remembers its key independently — switching providers and back restores your key.

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

Pull requests welcome. Two PRs have already shaped the project:

- **PR #1** by [@matwate](https://github.com/matwate) — OpenAI provider support, multi-provider architecture
- **PR #2** by [@desireco](https://github.com/desireco) — Z.ai provider, robust JSON parsing for truncated responses

---

A design experiment by [Saleh Kayyali](http://mskayyali.com).

---

## License

[MIT](LICENSE)
