"use client"

import { useState, useCallback } from "react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { CONTENT_TYPE_CONFIG } from "@/lib/content-types"
import {
  Sparkles, Layers, Kanban, GitFork, FolderDown,
  FolderInput, Download, Brain, Zap, Globe, Search, Check, Mail
} from "lucide-react"
import { useModKey } from "@/lib/utils"

interface AboutPanelProps {
  open: boolean
  onClose: () => void
}

function CopyEmailButton() {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText("mskayyali@me.com").then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border px-2 py-0.5 rounded-sm transition-all duration-300 cursor-pointer"
      style={{
        color:       copied ? "var(--color-emerald-400, #34d399)" : "color-mix(in oklch, var(--primary) 60%, transparent)",
        borderColor: copied ? "color-mix(in oklch, var(--color-emerald-400, #34d399) 35%, transparent)" : "color-mix(in oklch, var(--primary) 25%, transparent)",
      }}
    >
      <span className="relative flex items-center" style={{ width: "12px", height: "12px" }}>
        <Mail
          className="absolute inset-0 transition-all duration-300"
          style={{ width: "12px", height: "12px", opacity: copied ? 0 : 1, transform: copied ? "scale(0.6)" : "scale(1)" }}
        />
        <Check
          className="absolute inset-0 transition-all duration-300"
          style={{ width: "12px", height: "12px", opacity: copied ? 1 : 0, transform: copied ? "scale(1)" : "scale(0.6)" }}
        />
      </span>
      <span className="transition-all duration-300" style={{ opacity: copied ? 0.7 : 1 }}>
        {copied ? "Copied!" : "Copy email"}
      </span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 font-mono text-[10px] font-black text-primary">
        {n}
      </div>
      <div className="space-y-1 pt-0.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  )
}

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className="px-1.5 py-0.5 rounded-sm bg-secondary border border-border font-mono text-[10px] text-foreground">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  )
}

const CONTENT_TYPE_HIGHLIGHTS = [
  "claim", "question", "idea", "task", "thesis", "quote", "entity", "reference"
] as const

export function AboutPanel({ open, onClose }: AboutPanelProps) {
  const mod = useModKey()
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col gap-0 p-0 bg-card border-l border-border z-[200] overflow-hidden"
      >
        <SheetTitle className="sr-only">About nodepad</SheetTitle>

        {/* Header */}
        <div className="flex-shrink-0 px-8 pt-8 pb-6 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-0.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-primary" />
              <span className="inline-block h-3 w-3 rounded-sm bg-primary/60" />
              <span className="inline-block h-3 w-3 rounded-sm bg-primary/30" />
            </div>
            <h1 className="font-mono text-xl font-black text-foreground tracking-tight">nodepad</h1>
          </div>
          <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
            A spatial research tool that reads what you write and enriches it with AI — no prompting, no chat. Just capture your thinking and let the structure emerge.
          </p>
          <p className="mt-2 text-xs font-mono text-primary/60 uppercase tracking-widest">
            No chat · No prompts · AI that augments your thinking
          </p>
          <p className="mt-3 text-xs text-muted-foreground/50 flex items-center gap-3 flex-wrap">
            <span>
              A design experiment by{" "}
              <a
                href="http://mskayyali.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/70 hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Saleh Kayyali
              </a>
            </span>
            <a
              href="https://github.com/mskayyali/nodepad"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground border border-white/10 hover:border-white/25 px-2 py-0.5 rounded-sm transition-colors"
            >
              Source code ↗
            </a>
            <CopyEmailButton />
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground/35">
            This app uses anonymous analytics (Umami) to track feature interactions — views switched, exports, synthesis events. No note content, no personal data, no cross-site tracking.
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

          {/* Intro video */}
          <Section title="Watch the intro">
            <div className="relative w-full rounded-sm overflow-hidden border border-border/50" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube-nocookie.com/embed/nCLY7rHAjWE?rel=0&modestbranding=1&color=white"
                title="nodepad introduction"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </Section>

          {/* The idea */}
          <Section title="The idea">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Most AI tools ask you to prompt them. nodepad flips this — you write freely, and the AI quietly reads everything you've captured, classifies it, annotates it, finds contradictions, surfaces connections, and synthesises emerging insights. Your canvas evolves as you think.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              It's designed for researchers, writers, and deep thinkers who want a thinking partner — not a chatbot. The goal is to reduce the friction between a raw thought and a structured insight.
            </p>
          </Section>

          {/* Quick start */}
          <Section title="Quick start">
            <div className="space-y-4">
              <Step n={1} title="Add your API key">
                Open the sidebar (menu button top-left) → Settings → choose your provider and paste your API key. OpenRouter offers free credits at openrouter.ai. Without a key the app works but AI enrichment is disabled.
              </Step>
              <Step n={2} title="Capture anything">
                Type a thought, paste a quote, drop a URL, or write a question into the input bar at the bottom and press Enter. nodepad classifies it automatically.
              </Step>
              <Step n={3} title="Watch it enrich">
                Each node is sent to the AI in context with everything else on your canvas. It comes back with a type, category, annotation, and connections to related nodes.
              </Step>
              <Step n={4} title="Force a type with #type">
                Start your note with a shorthand like <code className="px-1 rounded bg-secondary font-mono text-xs text-primary">#claim</code>, <code className="px-1 rounded bg-secondary font-mono text-xs text-primary">#question</code>, or <code className="px-1 rounded bg-secondary font-mono text-xs text-primary">#idea</code> to override AI classification.
              </Step>
              <Step n={5} title="Watch for synthesis">
                After a few nodes, nodepad auto-generates a synthesis note — an emergent thesis drawn from everything on the canvas. Find it in the Synthesis panel (top-right sparkle icon).
              </Step>
            </div>
          </Section>

          {/* Content types */}
          <Section title="Content types">
            <p className="text-sm text-muted-foreground mb-3">
              nodepad recognises 14 types of thinking. Each node is classified into one automatically, and given a colour to match.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_TYPE_HIGHLIGHTS.map((type) => {
                const config = CONTENT_TYPE_CONFIG[type]
                const Icon = config.icon
                return (
                  <div key={type} className="flex items-center gap-2.5 px-3 py-2 rounded-sm bg-secondary/50 border border-border/50">
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: config.accentVar }} />
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: config.accentVar }}>
                        {config.label}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground/60 mt-2">
              Also: definition, opinion, reflection, narrative, comparison, general.
            </p>
          </Section>

          {/* Views */}
          <Section title="Views">
            <div className="space-y-3">
              <div className="flex gap-3 p-3 rounded-sm bg-secondary/30 border border-border/50">
                <Layers className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">Tiling <span className="font-mono text-[10px] text-muted-foreground/50 ml-1">{mod}1</span></p>
                  <p className="text-sm text-muted-foreground">Default. Nodes are laid out in a Binary Space Partition grid — each new node splits the available space. Navigate pages horizontally. A minimap in the bottom-right shows your spatial position.</p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-sm bg-secondary/30 border border-border/50">
                <Kanban className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">Kanban <span className="font-mono text-[10px] text-muted-foreground/50 ml-1">{mod}2</span></p>
                  <p className="text-sm text-muted-foreground">Nodes grouped into columns by content type. Good for reviewing your thinking by category. Tasks always appear first.</p>
                </div>
              </div>
              <div className="flex gap-3 p-3 rounded-sm bg-secondary/30 border border-border/50">
                <GitFork className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">Graph <span className="font-mono text-[10px] text-muted-foreground/50 ml-1">{mod}3</span></p>
                  <p className="text-sm text-muted-foreground">An interactive force-directed graph of all your nodes. Connections between them become the focus — highly-connected nodes drift toward the centre, isolated ones settle at the periphery. Click any node to open its full detail panel. Hover to dim unrelated nodes.</p>
                </div>
              </div>
            </div>
          </Section>

          {/* AI features */}
          <Section title="AI features">
            <div className="space-y-3">
              {[
                { icon: Brain, title: "Auto-classification", desc: "Every node is classified into one of 14 content types based on its meaning, not just its keywords." },
                { icon: Zap, title: "Contextual annotation", desc: "The AI reads your whole canvas and writes a 2–4 sentence annotation for each node that explains it in the context of everything else." },
                { icon: Search, title: "Connection mapping", desc: "Hover the dot indicator on any tile header to dim unrelated nodes and reveal which nodes are semantically connected. In Graph view, the same connections drive the layout — connected nodes pull toward each other." },
                { icon: Globe, title: "Web grounding", desc: "Enable web grounding in settings to have claims, questions, and references verified against live sources. Citations appear inline." },
                { icon: Sparkles, title: "Synthesis", desc: "After ≥3 nodes, nodepad quietly generates an emergent thesis — a 15–25 word synthesis of what you're actually thinking about. Solidify it to keep it, or dismiss." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3">
                  <Icon className="h-4 w-4 flex-shrink-0 text-primary/70 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">{title}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Export & data */}
          <Section title="Export & your data">
            <div className="space-y-3">
              <div className="flex gap-3">
                <FolderDown className="h-4 w-4 flex-shrink-0 text-primary/70 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">Export .nodepad</p>
                  <p className="text-sm text-muted-foreground">Save your full research space as a <code className="px-1 rounded bg-secondary font-mono text-xs">.nodepad</code> file. Import it on any device to pick up where you left off.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Download className="h-4 w-4 flex-shrink-0 text-primary/70 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">Export Markdown</p>
                  <p className="text-sm text-muted-foreground">Export a richly formatted Markdown document with YAML front matter, a table of contents, grouped sections, confidence tables for claims, and cited sources.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <FolderInput className="h-4 w-4 flex-shrink-0 text-primary/70 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">Your data, locally</p>
                  <p className="text-sm text-muted-foreground">Everything is stored in your browser's localStorage — no account, no cloud sync, no data sent to any server except your notes being enriched via OpenRouter (using your own API key).</p>
                </div>
              </div>
            </div>
          </Section>

          {/* Keyboard shortcuts */}
          <Section title="Keyboard shortcuts">
            <div className="rounded-sm border border-border overflow-hidden">
              <div className="px-3 divide-y divide-border/40">
                <Shortcut keys={[mod, "K"]} label="Command menu" />
                <Shortcut keys={[mod, "Z"]} label="Undo last action" />
                <Shortcut keys={["Enter"]} label="Submit a new node" />
                <Shortcut keys={["Esc"]} label="Close command menu / deselect" />
              </div>
            </div>
          </Section>

          {/* Tips */}
          <Section title="Tips">
            <ul className="space-y-2">
              {[
                "Write in fragments — nodepad handles the structure. You don't need to write in full sentences.",
                "Mix types freely. A canvas with claims, questions, and quotes is richer than one with only one type.",
                "Switch to Graph view (via ⌘K → Graph) to understand which nodes are central to your thinking and which are peripheral.",
                "The canvas index (⌘K → Index) groups nodes by category — hovering a title in the index highlights the matching node in any view.",
                "Pin important nodes with the pin icon in Tiling view so they stand out visually.",
                "Tasks added to the canvas become a sub-task list — add sub-tasks by nesting them in the tile.",
                "Use multiple projects (sidebar) to keep separate research threads isolated.",
              ].map((tip, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                  <span className="flex-shrink-0 font-mono text-[10px] text-primary/50 mt-0.5 pt-px">→</span>
                  {tip}
                </li>
              ))}
            </ul>
          </Section>

          {/* Footer */}
          <div className="pt-2 pb-4 border-t border-border">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-sm bg-primary" />
              <span className="inline-block h-1.5 w-1.5 rounded-sm bg-primary/60" />
              <span className="inline-block h-1.5 w-1.5 rounded-sm bg-primary/30" />
              <span className="font-mono text-[10px] font-bold text-muted-foreground/40 ml-1">nodepad</span>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  )
}
