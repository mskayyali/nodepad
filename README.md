# nodepad

**A design experiment in spatial, AI-augmented thinking.**

[![Watch the intro](https://img.youtube.com/vi/nCLY7rHAjWE/maxresdefault.jpg)](https://www.youtube.com/watch?v=nCLY7rHAjWE)

_[Watch the intro →](https://www.youtube.com/watch?v=nCLY7rHAjWE)_

---

Most AI tools are built around a chat interface: you ask, it answers, you ask again. The interaction is sequential, conversational, and optimised for producing output. nodepad is built around a different premise: that thinking is spatial and associative, and that AI is most useful when it works quietly in the background rather than at the centre of attention.

You add notes. The AI classifies them, finds connections between them, surfaces what you haven't said yet, and occasionally synthesises an emergent insight from the whole canvas. You stay in control of the space. The AI earns its place by being genuinely useful rather than prominent.

## How it works

Notes are typed into the input bar and placed onto a spatial canvas. Each note is automatically classified into one of 14 types — claim, question, idea, task, entity, quote, reference, definition, opinion, reflection, narrative, comparison, thesis, general — and enriched with a short annotation that adds something the note doesn't already say.

Connections between notes are inferred from content. When you hover a connection indicator, unrelated notes dim. When enough notes accumulate, a synthesis emerges — a single sentence that bridges the tensions across the canvas. You can solidify it into a thesis note or dismiss it.

Three views: **tiling** (spatial BSP grid), **kanban** (grouped by type), **graph** (force-directed, centrality-radial).

## What this fork changes

- [x] **Optional Centralised Database Storage**: Enables running Notepad on a server with support for multi-user management, cloud-based session storage, and related features. Still works fully locally without requiring PostgreSQL setup.
- [x] **Inference Provider Flexibility**: Supports any text-based model via OpenRouter, along with custom endpoints for tools like LM Studio or Ollama. (Thanks to @aayushprsingh)
- [ ] Quality-of-Life Improvements: Basic autocomplete for note tags when using `#`, custom themes, more extensive keybinds, etc
- [ ] **Standalone Note-Taking Mode**: Option to disable all AI features entirely, preventing API-related errors from appearing in the frontend.
- [ ] Desktop App Packaging: Packaging as a standalone desktop app using Tauri or Electron, likely incorporating changes from the @kpulik branch.

Apart from self-hosting, a completely free to use instance of this fork is available at [nodepad.adityagupta.dev](https://nodepad.adityagupta.dev) while the upstream project is hosted by @mskayali at [nodepad.space](https://nodepad.space).

### Upstream Contribution Approach

This fork is intended as a fast moving, experimental version of nodepad, with features that may be opinionated or introduce breaking changes.

Because of this, most changes are not planned for upstream contribution. However, improvements that are broadly useful and align with the original project’s vision may still be proposed upstream.

Upstream updates will continue to be merged into this fork where applicable.

## Setup

**Requirements**: a desktop browser and an API key from one of the supported providers.

```bash
git clone https://github.com/mskayyali/nodepad.git
cd nodepad
npm install
```

<details>
  <summary><b>Optional: Setup Postgres server</b></summary>

This fork uses Prisma with PostgreSQL for data storage. If you want to use the database features (multi-user support, cloud sessions, etc), follow these steps:

### Environment

- `DATABASE_URL` must point to your PostgreSQL instance.
- Run `npx prisma migrate dev` and `npx prisma generate` after configuring the database.

### PostgreSQL setup (local)

1. Create the database and user:

   ```bash
   createdb nodepad
   psql -c "CREATE USER nodepad_user WITH PASSWORD 'nodepad_pass';"
   psql -c "GRANT ALL PRIVILEGES ON DATABASE nodepad TO nodepad_user;"
   ```

2. Add a `.env.local` file:

   ```env
   DATABASE_URL="postgresql://nodepad_user:nodepad_pass@localhost:5432/nodepad?schema=public"
   ```

   You can change `nodepad_user` and `nodepad_pass` to your preferred username and password.

3. Run migrations and generate the Prisma client:

   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

#### Troubleshooting db issues

```
CREATE DATABASE nodepad;

CREATE USER nodepad_user WITH PASSWORD 'nodepad_pass';

ALTER DATABASE nodepad OWNER TO nodepad_user;

ALTER USER nodepad_user CREATEDB;
```

```
\c nodepad

ALTER SCHEMA public OWNER TO nodepad_user;

GRANT ALL ON SCHEMA public TO nodepad_user;

GRANT USAGE, CREATE ON SCHEMA public TO nodepad_user;
```

</details>

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000).

**Add your API key**: click the menu icon (top-left) → Settings → choose your provider → paste your key. The key is stored in your browser's `localStorage` and goes directly to the AI provider — it never passes through any server.

**Enable web grounding** (optional): toggle "Web grounding" in Settings to let the AI cite real sources for claims, questions, and references. Supported on OpenRouter `:online` models and OpenAI search-preview models.

## Providers & Models

Select provider and model from the sidebar Settings panel. Each provider remembers its key independently — switching providers and back restores your key.

### OpenRouter _(default)_

Access to all major models through a single key. Create a free account at [openrouter.ai](https://openrouter.ai) — use the free-tier models below with no credits, or add credits for GPT-4o, Claude, and Gemini.

| Model                         | Notes                                              |
| ----------------------------- | -------------------------------------------------- |
| `openai/gpt-4o`               | Default. Strong annotation quality, web grounding. |
| `anthropic/claude-sonnet-4-5` | Strong reasoning, complex research.                |
| `google/gemini-2.5-pro`       | Long context, web grounding.                       |
| `deepseek/deepseek-chat`      | Fast, cost-effective.                              |
| `mistralai/mistral-small-3.2` | Lightweight, fast.                                 |

**Free tier** — no credits required, ~200 req/day limit, Nvidia-hosted, no web grounding:

| Model                                    | Notes                                           |
| ---------------------------------------- | ----------------------------------------------- |
| `nvidia/nemotron-3-nano-30b-a3b:free`    | Nemotron 30B — fast, reliable.                  |
| `nvidia/nemotron-3-super-120b-a12b:free` | Nemotron 120B MoE — higher quality, same speed. |

**Custom Models** - Select any text-based models by entering the provider and model name.

### OpenAI _(direct)_

Use your OpenAI API key directly. Web grounding via search-preview models.

| Model         | Notes                                         |
| ------------- | --------------------------------------------- |
| `gpt-4o`      | Strong structured output, web grounding.      |
| `gpt-4o-mini` | Fast, capable, web grounding.                 |
| `gpt-4.1`     | Latest GPT-4, improved instruction following. |
| `o4-mini`     | Fast reasoning model.                         |

### Z.ai

GLM models from Zhipu AI. Get a key at [z.ai](https://z.ai/manage-apikey/apikey-list).

| Model         | Notes                           |
| ------------- | ------------------------------- |
| `glm-4.7`     | Strong reasoning, 200K context. |
| `glm-5`       | Z.ai flagship model.            |
| `glm-5-turbo` | Fast, community-tested.         |

### Custom Endpoint

## Keyboard shortcuts

|          |                                             |
| -------- | ------------------------------------------- |
| `Enter`  | Add note                                    |
| `⌘K`     | Command palette (views, navigation, export) |
| `⌘Z`     | Undo                                        |
| `Escape` | Deselect / close panels                     |

Double-click any note to edit. Click the type label to reclassify manually.

## Data

Projects, notes, and sessions are stored on the server (PostgreSQL). Sessions use secure, httpOnly cookies, and your data syncs across logins.

- Register/login with server-side sessions
- Projects and notes are persisted in PostgreSQL per account
- Export to `.md` or `.nodepad` (versioned JSON) via `⌘K`
- Import `.nodepad` files via the sidebar

## Tech

Next.js · React 19 · TypeScript · Tailwind CSS v4 · D3.js · Framer Motion

## Contributing

Pull requests are welcome. I go through them regularly. Some will be merged, others may stay open.

---

A design experiment by [Saleh Kayyali](http://mskayyali.com).

## License

[MIT](LICENSE)
