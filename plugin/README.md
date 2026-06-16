# Nodepad — Obsidian Plugin

A spatial research tool where AI augments your thinking. Each `.nodepad` file is an independent canvas with tiling, kanban, and graph views.

Not yet listed in the Obsidian community plugins directory — install manually using the steps below.

---

## Installation

### 1. Build

```bash
cd plugin
npm install
npm run build
```

This produces the deployable files in `plugin/dist/`.

### 2. Copy files into your vault

Copy `plugin/dist/` into your vault's plugin folder:

```
<your-vault>/.obsidian/plugins/nodepad/
```

The `dist/` folder already contains all three required files — `main.js`, `manifest.json`, and `styles.css`.

### 3. Enable the plugin

1. Open Obsidian → **Settings** → **Community plugins**
2. Turn off **Restricted mode** if prompted
3. Find **Nodepad** in the installed list and toggle it on

### 4. Add your API key

1. Go to **Settings** → **Nodepad**
2. Choose a provider — OpenRouter, OpenAI, Anthropic, or Z.ai
3. Paste your API key
4. Set the model ID (e.g. `openai/gpt-4o` for OpenRouter, `claude-sonnet-4-6` for Anthropic)

API keys are stored in `.obsidian/plugins/nodepad/data.json` — local to your vault, never synced to any server.

### 5. Create your first space

Click the **Nodepad** icon in the left ribbon, or run **New Nodepad Space** from the command palette (`Ctrl/Cmd + P`). This creates a new `.nodepad` file in your vault root.

You can also create a `.nodepad` file anywhere in your vault manually — Obsidian will open it with the Nodepad view automatically.

---

## Usage

### Adding notes

Type in the input bar at the bottom and press **Enter**. The AI will classify and annotate each note automatically.

Prefix with `#type` to force a content type:

```
#claim The Zettelkasten method scales poorly beyond 10,000 notes
#question What makes a note system collapse under its own weight?
#task Review Luhmann's original card boxes
```

### Views

Switch between views from the command palette (`Ctrl/Cmd + K`) or the status bar:

| View | Best for |
|---|---|
| **Tiling** | Dense reading, annotation review |
| **Kanban** | Category-based organisation |
| **Graph** | Seeing connections between notes |

### Ghost synthesis

Once you have 5+ enriched notes across 2+ categories, the AI generates an **emergent thesis** — a cross-category insight you haven't explicitly stated. Ghost notes appear in the synthesis panel (sparkle icon in the status bar). Claim one to add it to your canvas as a citable thesis node.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Open command palette |
| `Ctrl/Cmd + Z` | Undo last block operation |
| `Escape` | Close palette / synthesis panel |

### Export

From the command palette: **Export markdown** saves a `.md` file to your vault root. **Copy markdown** puts it on the clipboard.

---

## Development (hot reload)

Instead of copying files on every rebuild, symlink `plugin/dist/` directly into your vault:

**macOS / Linux**
```bash
ln -s "$(pwd)/plugin/dist" "<your-vault>/.obsidian/plugins/nodepad"
```

**Windows (PowerShell, run as Administrator)**
```powershell
New-Item -ItemType Junction -Path "<your-vault>\.obsidian\plugins\nodepad" -Target (Resolve-Path .\plugin\dist)
```

Then start the dev watcher (JS + CSS in parallel):

```bash
cd plugin
npm run dev
```

Obsidian will pick up JS changes automatically if you have the [Hot Reload plugin](https://github.com/pjeby/hot-reload) installed. CSS changes take effect on the next plugin reload (`Ctrl/Cmd + R`).
