import { TextFileView, WorkspaceLeaf, Notice } from "obsidian"
import { createRoot, type Root } from "react-dom/client"
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type NodepadPlugin from "./main"
import { enrichBlock, generateGhost } from "./ai-adapter"

import { TilingArea } from "@/components/tiling-area"
import { KanbanArea } from "@/components/kanban-area"
import { GraphArea } from "@/components/graph-area"
import { StatusBar } from "@/components/status-bar"
import { GhostPanel, type GhostNote } from "@/components/ghost-panel"
import { VimInput } from "@/components/vim-input"
import { TileIndex } from "@/components/tile-index"
import type { TextBlock } from "@/components/tile-card"
import type { ContentType } from "@/lib/content-types"
import { detectContentType } from "@/lib/detect-content-type"
import { exportToMarkdown, copyToClipboard } from "@/lib/export"

export const VIEW_TYPE = "nodepad-view"

// ── File data format ──────────────────────────────────────────────────────────

interface NodepadData {
  version?: number
  blocks: TextBlock[]
  collapsedIds: string[]
  ghostNotes: GhostNote[]
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
  lastGhostTexts?: string[]
  viewMode?: "tiling" | "kanban" | "graph"
}

function parseFileData(raw: string): NodepadData {
  try {
    const parsed = JSON.parse(raw || "{}")
    const src = parsed.project ?? {}
    return {
      version: parsed.version ?? 1,
      blocks: (src.blocks ?? []).map((b: TextBlock) => ({
        ...b,
        isEnriching: false,
        isError: false,
        statusText: undefined,
      })),
      collapsedIds: src.collapsedIds ?? [],
      ghostNotes: (src.ghostNotes ?? []).map((n: GhostNote) => ({
        ...n,
        isGenerating: false,
      })),
      lastGhostBlockCount: src.lastGhostBlockCount,
      lastGhostTimestamp:  src.lastGhostTimestamp,
      lastGhostTexts:      src.lastGhostTexts,
      viewMode: src.viewMode ?? "tiling",
    }
  } catch {
    return { version: 1, blocks: [], collapsedIds: [], ghostNotes: [], viewMode: "tiling" }
  }
}

/** Serialise state back to NodepadFile format (compatible with the web app). */
function serialiseFileData(
  fileName: string | undefined,
  blocks: TextBlock[],
  collapsedIds: string[],
  ghostNotes: GhostNote[],
  lastGhostBlockCount: number,
  lastGhostTimestamp: number,
  lastGhostTexts: string[],
  viewMode: "tiling" | "kanban" | "graph",
): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: Date.now(),
      project: {
        id: generateId(),
        name: fileName ?? "Nodepad",
        blocks: blocks.map((b) => ({
          ...b,
          isEnriching: undefined,
          isError: undefined,
          statusText: undefined,
        })),
        collapsedIds,
        ghostNotes: ghostNotes.filter((n) => !n.isGenerating),
        lastGhostBlockCount,
        lastGhostTimestamp,
        lastGhostTexts,
        viewMode,
      },
    },
    null,
    2,
  )
}

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

// ── Obsidian view class ───────────────────────────────────────────────────────

export class NodepadView extends TextFileView {
  private root: Root | null = null
  readonly plugin: NodepadPlugin
  private fileData = ""

  constructor(leaf: WorkspaceLeaf, plugin: NodepadPlugin) {
    super(leaf)
    this.plugin = plugin
  }

  getViewType() { return VIEW_TYPE }
  getDisplayText() { return this.file?.basename ?? "Nodepad" }
  getIcon() { return "layout-dashboard" }

  setViewData(data: string, clear: boolean) {
    this.fileData = data
    if (clear || !this.root) {
      if (this.root) { this.root.unmount(); this.root = null }
      this.renderRoot()
    }
  }

  getViewData() { return this.fileData }
  clear() { this.fileData = "" }

  async onOpen() {
    this.registerEvent(
      this.app.vault.on("rename", (file) => {
        if (file === this.file) this.renderRoot()
      })
    )
  }

  async onClose() {
    this.root?.unmount()
    this.root = null
  }

  private renderRoot() {
    const container = this.containerEl.children[1] as HTMLElement
    container.style.height = "100%"
    container.style.overflow = "hidden"
    container.style.contain = "layout paint"
    container.style.isolation = "isolate"
    container.classList.add("nodepad-view")
    if (!this.root) {
      this.root = createRoot(container)
    }
    const plugin = this.plugin
    this.root.render(
      <React.StrictMode>
        <NodepadApp
          plugin={plugin}
          initialData={this.fileData}
          fileName={this.file?.basename}
          folderPath={this.file?.parent?.path}
          onSave={(data) => {
            this.fileData = data
            this.requestSave()
          }}
          onMenuClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const setting = (plugin.app as any).setting
            setting?.open()
            setting?.openTabById(plugin.manifest.id)
          }}
          portalContainer={container}
        />
      </React.StrictMode>
    )
  }
}

// ── React app ─────────────────────────────────────────────────────────────────

interface NodepadAppProps {
  plugin: NodepadPlugin
  initialData: string
  fileName?: string
  folderPath?: string
  onSave: (data: string) => void
  onMenuClick: () => void
  portalContainer?: HTMLElement
}

function NodepadApp({ plugin, initialData, fileName, folderPath, onSave, onMenuClick, portalContainer }: NodepadAppProps) {
  const parsed = useMemo(() => parseFileData(initialData), [initialData])

  const [blocks, setBlocks] = useState<TextBlock[]>(parsed.blocks)
  const [collapsedIds, setCollapsedIds] = useState<string[]>(parsed.collapsedIds)
  const [ghostNotes, setGhostNotes] = useState<GhostNote[]>(parsed.ghostNotes)
  const [lastGhostBlockCount, setLastGhostBlockCount] = useState(parsed.lastGhostBlockCount ?? 0)
  const [lastGhostTimestamp, setLastGhostTimestamp] = useState(parsed.lastGhostTimestamp ?? 0)
  const [lastGhostTexts, setLastGhostTexts] = useState<string[]>(parsed.lastGhostTexts ?? [])
  const [viewMode, setViewMode] = useState<"tiling" | "kanban" | "graph">(parsed.viewMode ?? "tiling")

  const [isGhostPanelOpen, setIsGhostPanelOpen] = useState(false)
  const [isIndexOpen, setIsIndexOpen] = useState(false)
  const [isCommandKOpen, setIsCommandKOpen] = useState(false)
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null)
  const [undoToast, setUndoToast] = useState<string | null>(null)

  const blocksRef = useRef(blocks)
  useEffect(() => { blocksRef.current = blocks }, [blocks])

  const generatingRef = useRef<Set<string>>(new Set())
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})
  const blockHistoryRef = useRef<TextBlock[][]>([])
  const undoToastTimer = useRef<NodeJS.Timeout | null>(null)
  const hasMountedRef = useRef(false)

  // ── Persistence ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    onSave(serialiseFileData(
      fileName, blocks, collapsedIds, ghostNotes,
      lastGhostBlockCount, lastGhostTimestamp, lastGhostTexts, viewMode,
    ))
  }, [blocks, collapsedIds, ghostNotes, viewMode])

  useEffect(() => () => {
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current)
    Object.values(debounceTimers.current).forEach(clearTimeout)
  }, [])

  // ── Undo ──────────────────────────────────────────────────────────────────

  const pushHistory = useCallback((current: TextBlock[]) => {
    blockHistoryRef.current.push(current.map(b => ({ ...b })))
    if (blockHistoryRef.current.length > 20) blockHistoryRef.current.shift()
  }, [])

  const showUndoToast = useCallback((msg: string) => {
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current)
    setUndoToast(msg)
    undoToastTimer.current = setTimeout(() => setUndoToast(null), 2200)
  }, [])

  const undo = useCallback(() => {
    const previous = blockHistoryRef.current.pop()
    if (!previous) { showUndoToast("Nothing to undo"); return }
    setBlocks(previous)
    showUndoToast("↩ Undone")
  }, [showUndoToast])

  // ── Ghost context builder ─────────────────────────────────────────────────

  function buildGhostContext(enrichedBlocks: TextBlock[]) {
    if (enrichedBlocks.length <= 8) return enrichedBlocks
    const sorted = [...enrichedBlocks].sort((a, b) => b.timestamp - a.timestamp)
    const selected = new Set<string>()
    const result: TextBlock[] = []
    sorted.slice(0, 4).forEach(b => { selected.add(b.id); result.push(b) })
    const representedCats = new Set(result.map(b => b.category))
    const byCat = new Map<string, TextBlock>()
    sorted.forEach(b => { if (b.category && !byCat.has(b.category)) byCat.set(b.category, b) })
    for (const [cat, block] of byCat) {
      if (result.length >= 10) break
      if (!representedCats.has(cat) && !selected.has(block.id)) {
        selected.add(block.id); result.push(block); representedCats.add(cat)
      }
    }
    for (const b of sorted) {
      if (result.length >= 10) break
      if (!selected.has(b.id)) { selected.add(b.id); result.push(b) }
    }
    return result
  }

  // ── Ghost note generation ─────────────────────────────────────────────────

  const generateGhostNote = useCallback(async () => {
    const enrichedBlocks = blocksRef.current.filter(b => !b.isEnriching && b.category)
    if (enrichedBlocks.length < 5) return
    if (ghostNotes.length >= 5) return
    if (generatingRef.current.has("ghost")) return
    if (enrichedBlocks.length < lastGhostBlockCount + 5) return
    if (Date.now() - lastGhostTimestamp < 5 * 60 * 1000) return
    const categories = new Set(enrichedBlocks.map(b => b.category).filter(Boolean))
    if (categories.size < 2) return

    generatingRef.current.add("ghost")
    const ghostId = "ghost-" + generateId()
    setGhostNotes(prev => [...prev, { id: ghostId, text: "", category: "thesis", isGenerating: true }])
    setLastGhostBlockCount(enrichedBlocks.length)
    setLastGhostTimestamp(Date.now())

    try {
      const curated = buildGhostContext(enrichedBlocks)
      const context = curated.map(b => ({ text: b.text, category: b.category, contentType: b.contentType }))
      const previousSyntheses = lastGhostTexts.slice(-5)
      const data = await generateGhost(plugin, context, previousSyntheses)
      setGhostNotes(prev =>
        prev.map(n => n.id === ghostId ? { ...n, text: data.text, category: data.category, isGenerating: false } : n)
      )
      setLastGhostTexts(prev => [...prev, data.text].slice(-10))
    } catch (e) {
      console.error("Ghost generation failed", e)
      setGhostNotes(prev => prev.filter(n => n.id !== ghostId))
    } finally {
      generatingRef.current.delete("ghost")
    }
  }, [plugin, ghostNotes, lastGhostBlockCount, lastGhostTimestamp, lastGhostTexts])

  // ── Enrich block ──────────────────────────────────────────────────────────

  const doEnrich = useCallback(async (
    id: string, text: string, category?: string, forcedType?: string
  ) => {
    const context = blocksRef.current
      .filter(b => b.id !== id && !b.isEnriching)
      .map(b => ({ id: b.id, text: b.text, category: b.category, annotation: b.annotation }))
      .slice(-15)

    try {
      const data = await enrichBlock(plugin, text, context, forcedType, category)
      const influencedBy = (data.influencedByIndices ?? [])
        .map((idx: number) => context[idx]?.id)
        .filter(Boolean) as string[]

      setBlocks(current => {
        const mergeTargetId = data.mergeWithIndex !== null ? context[data.mergeWithIndex ?? -1]?.id : null

        if (mergeTargetId) {
          return current
            .filter(b => b.id !== id)
            .map(b => b.id === mergeTargetId ? {
              ...b, text: b.text + "\n\n" + text,
              contentType: data.contentType, category: data.category,
              annotation: data.annotation, confidence: data.confidence,
              influencedBy, isUnrelated: data.isUnrelated,
              sources: data.sources ?? undefined,
              isEnriching: false, statusText: undefined, isError: false,
            } : b)
        }

        if (data.contentType === "task") {
          const existingTask = current.find(b => b.contentType === "task" && b.id !== id)
          if (existingTask) {
            const subTask = { id: generateId(), text, isDone: false, timestamp: Date.now() }
            return current
              .filter(b => b.id !== id)
              .map(b => b.id === existingTask.id ? {
                ...b, subTasks: [...(b.subTasks || []), subTask],
                isEnriching: false, statusText: undefined,
              } : b)
          }
          return current.map(b => b.id === id ? {
            ...b, contentType: "task", category: "Tasks",
            subTasks: [{ id: generateId(), text, isDone: false, timestamp: Date.now() }],
            isEnriching: false, statusText: undefined, isError: false,
          } : b)
        }

        return current.map(b => b.id === id ? {
          ...b, contentType: data.contentType, category: data.category,
          annotation: data.annotation, confidence: data.confidence,
          influencedBy, isUnrelated: data.isUnrelated,
          sources: data.sources ?? undefined,
          isEnriching: false, statusText: undefined, isError: false,
        } : b)
      })

      setTimeout(() => generateGhostNote(), 2500)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : undefined
      const isNoKey = msg?.includes("No API key") || msg?.includes("Invalid or missing API key")
      setBlocks(current => current.map(b => b.id === id ? {
        ...b, isEnriching: false, isError: true,
        statusText: isNoKey ? "no-api-key" : msg,
      } : b))
      if (isNoKey) new Notice("No API key set — open Settings → Nodepad")
    }
  }, [plugin, generateGhostNote])

  // ── Block operations ──────────────────────────────────────────────────────

  const addBlock = useCallback((text: string, forcedType?: ContentType) => {
    let resolvedText = text
    let resolvedType = forcedType
    if (!resolvedType) {
      const tagMatch = text.match(/^#([a-z]+)\s+(.+)/i)
      if (tagMatch) {
        const tag = tagMatch[1].toLowerCase() as ContentType
        const ALL_TYPES: ContentType[] = [
          "entity","claim","question","task","idea","reference","quote",
          "definition","opinion","reflection","narrative","comparison","thesis","general",
        ]
        if (ALL_TYPES.includes(tag)) { resolvedType = tag; resolvedText = tagMatch[2].trim() }
      }
    }
    const newId = generateId()
    const heuristicType = resolvedType ?? detectContentType(resolvedText)
    const HIGH_CONFIDENCE_TYPES = new Set<ContentType>(["question","reference","quote","task"])
    const enrichForcedType = resolvedType ?? (HIGH_CONFIDENCE_TYPES.has(heuristicType) ? heuristicType : undefined)
    const initialDisplayType: ContentType = resolvedType ?? (HIGH_CONFIDENCE_TYPES.has(heuristicType) ? heuristicType : "general")

    pushHistory(blocksRef.current)
    setBlocks(prev => [...prev, { id: newId, text: resolvedText, timestamp: Date.now(), contentType: initialDisplayType, isEnriching: true }])
    setIsCommandKOpen(false)
    doEnrich(newId, resolvedText, undefined, enrichForcedType).catch(console.error)
  }, [pushHistory, doEnrich])

  const deleteBlock = useCallback((id: string) => {
    pushHistory(blocksRef.current)
    setBlocks(prev => prev.filter(b => b.id !== id))
  }, [pushHistory])

  const editBlock = useCallback((id: string, newText: string) => {
    setBlocks(prev => {
      const block = prev.find(b => b.id === id)
      if (!block || block.text === newText) return prev
      pushHistory(prev)
      if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id])
      debounceTimers.current[id] = setTimeout(() => {
        doEnrich(id, newText, block.category).catch(console.error)
        delete debounceTimers.current[id]
      }, 800)
      return prev.map(b => b.id === id ? { ...b, text: newText, isEnriching: true, isError: false } : b)
    })
  }, [pushHistory, doEnrich])

  const reEnrichBlock = useCallback((id: string, newCategory?: string) => {
    const block = blocksRef.current.find(b => b.id === id)
    if (!block) return
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, category: newCategory, isEnriching: true } : b))
    doEnrich(id, block.text, newCategory ?? block.category, block.contentType as string).catch(console.error)
  }, [doEnrich])

  const editAnnotation = useCallback((id: string, newAnnotation: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, annotation: newAnnotation } : b))
  }, [])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return [...next]
    })
  }, [])

  const handleTogglePin = useCallback((id: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, isPinned: !b.isPinned } : b))
  }, [])

  const handleToggleSubTask = useCallback((blockId: string, subTaskId: string) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? {
      ...b, subTasks: b.subTasks?.map((st: { id: string; text: string; isDone: boolean; timestamp: number }) => st.id === subTaskId ? { ...st, isDone: !st.isDone } : st),
    } : b))
  }, [])

  const handleDeleteSubTask = useCallback((blockId: string, subTaskId: string) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? {
      ...b, subTasks: b.subTasks?.filter(st => st.id !== subTaskId),
    } : b))
  }, [])

  const handleChangeType = useCallback((id: string, newType: ContentType) => {
    const block = blocksRef.current.find(b => b.id === id)
    if (!block) return
    pushHistory(blocksRef.current)
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, contentType: newType, isEnriching: true } : b))
    doEnrich(id, block.text, block.category, newType).catch(console.error)
  }, [pushHistory, doEnrich])

  const clearBlocks = useCallback(() => {
    pushHistory(blocksRef.current)
    setBlocks([])
    setCollapsedIds([])
  }, [pushHistory])

  // ── Ghost operations ──────────────────────────────────────────────────────

  const claimGhostNote = useCallback((id: string) => {
    const note = ghostNotes.find(n => n.id === id)
    if (!note || note.isGenerating) return
    const newId = generateId()
    setGhostNotes(prev => prev.filter(n => n.id !== id))
    setBlocks(prev => [...prev, {
      id: newId, text: note.text, timestamp: Date.now(),
      contentType: "thesis" as ContentType, category: note.category, isEnriching: true,
    }])
    doEnrich(newId, note.text, note.category, "thesis").catch(console.error)
  }, [ghostNotes, doEnrich])

  const dismissGhostNote = useCallback((id: string) => {
    setGhostNotes(prev => prev.filter(n => n.id !== id))
  }, [])

  // ── Workspace operations (single-file = single space) ─────────────────────

  const workspaceOptions = useMemo(() => [{ id: "this", name: fileName ?? "This space" }], [fileName])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsCommandKOpen(prev => !prev)
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); undo() }
      }
      if (e.key === "Escape") {
        if (isCommandKOpen) setIsCommandKOpen(false)
        else if (isGhostPanelOpen) setIsGhostPanelOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeys, { capture: true })
    return () => window.removeEventListener("keydown", handleKeys, { capture: true })
  }, [isCommandKOpen, isGhostPanelOpen, undo])

  // ── Command handler ───────────────────────────────────────────────────────

  const handleCommand = useCallback((cmd: string, text?: string) => {
    setIsCommandKOpen(false)
    if      (cmd === "kanban") setViewMode("kanban")
    else if (cmd === "tiling") setViewMode("tiling")
    else if (cmd === "graph")  setViewMode("graph")
    else if (cmd === "open-synthesis") { setIsIndexOpen(false); setIsGhostPanelOpen(prev => !prev) }
    else if (cmd === "open-index")     { setIsGhostPanelOpen(false); setIsIndexOpen(prev => !prev) }
    else if (cmd === "clear") clearBlocks()
    else if (cmd === "export-md") {
      const md = exportToMarkdown(fileName ?? "Nodepad", blocksRef.current)
      const slug = (fileName ?? "Nodepad").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
      const exportPath = folderPath && folderPath !== "/" ? `${folderPath}/${slug}-export.md` : `${slug}-export.md`
      plugin.app.vault.create(exportPath, md)
        .then(() => new Notice("Markdown saved to vault"))
        .catch(() => {
          copyToClipboard(md)
          new Notice("Copied to clipboard")
        })
    }
    else if (cmd === "copy-md") {
      const md = exportToMarkdown(fileName ?? "Nodepad", blocksRef.current)
      copyToClipboard(md)
      new Notice("Copied to clipboard")
    }
    else if (cmd === "task"   && text) addBlock(text, "task")
    else if (cmd === "thesis" && text) addBlock(text, "thesis")
  }, [clearBlocks, addBlock, fileName, plugin])

  // ── Render ────────────────────────────────────────────────────────────────

  const hasKey = !!plugin.settings.apiKey
  const modelLabel = hasKey ? plugin.settings.modelId.split("/").pop() : undefined

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <StatusBar
          blockCount={blocks.length}
          blocks={blocks}
          activeProjectName={fileName ?? "Nodepad"}
          isSidebarOpen={false}
          isIndexOpen={isIndexOpen}
          isGhostPanelOpen={isGhostPanelOpen}
          ghostNoteCount={ghostNotes.filter(n => !n.isGenerating).length}
          onMenuClick={onMenuClick}
          onIndexToggle={() => setIsIndexOpen(prev => !prev)}
          onGhostPanelToggle={() => setIsGhostPanelOpen(prev => !prev)}
          modelLabel={modelLabel}
          portalContainer={portalContainer}
        />

        {!hasKey && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 bg-amber-950/80 border-b border-amber-800/60 text-amber-200 text-xs shrink-0">
            <span className="opacity-80">
              ⚡ No API key — open <strong>Settings → Nodepad</strong> to configure.
            </span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden relative">
          <main className="relative flex-1 overflow-hidden">
            {viewMode === "tiling" ? (
              <TilingArea
                key="tiling"
                blocks={blocks}
                collapsedIds={new Set(collapsedIds)}
                onDelete={deleteBlock}
                onEdit={editBlock}
                onEditAnnotation={editAnnotation}
                onReEnrich={reEnrichBlock}
                onChangeType={handleChangeType}
                onToggleCollapse={toggleCollapse}
                onTogglePin={handleTogglePin}
                onToggleSubTask={handleToggleSubTask}
                onDeleteSubTask={handleDeleteSubTask}
                highlightedBlockId={highlightedBlockId}
                onHighlight={setHighlightedBlockId}
                workspaces={workspaceOptions}
                activeWorkspaceId="this"
                onMoveToWorkspace={() => {}}
                onCopyToWorkspace={() => {}}
              />
            ) : viewMode === "kanban" ? (
              <KanbanArea
                key="kanban"
                blocks={blocks}
                collapsedIds={new Set(collapsedIds)}
                onDelete={deleteBlock}
                onEdit={editBlock}
                onEditAnnotation={editAnnotation}
                onReEnrich={reEnrichBlock}
                onChangeType={handleChangeType}
                onToggleCollapse={toggleCollapse}
                onTogglePin={handleTogglePin}
                onToggleSubTask={handleToggleSubTask}
                onDeleteSubTask={handleDeleteSubTask}
              />
            ) : (
              <GraphArea
                key="graph"
                blocks={blocks}
                ghostNote={ghostNotes[ghostNotes.length - 1]}
                projectName={fileName ?? "Nodepad"}
                onReEnrich={reEnrichBlock}
                onChangeType={handleChangeType}
                onTogglePin={handleTogglePin}
                onEdit={editBlock}
                onEditAnnotation={editAnnotation}
                highlightedBlockId={highlightedBlockId}
                onHighlight={setHighlightedBlockId}
              />
            )}
          </main>

          <GhostPanel
            ghostNotes={ghostNotes}
            isOpen={isGhostPanelOpen}
            onClose={() => setIsGhostPanelOpen(false)}
            onClaim={claimGhostNote}
            onDismiss={dismissGhostNote}
          />
        </div>

        <AnimatePresence>
          {undoToast && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute bottom-[72px] left-1/2 -translate-x-1/2 z-[130] pointer-events-none"
            >
              <div className="px-3 py-1.5 rounded-sm bg-black/90 border border-white/15 backdrop-blur-md shadow-xl">
                <span className="font-mono text-[10px] text-white/70 tracking-tight whitespace-nowrap">{undoToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <VimInput
          onSubmit={addBlock}
          onCommand={handleCommand}
          isCommandKOpen={isCommandKOpen}
          setIsCommandKOpen={setIsCommandKOpen}
          isPlugin
        />
      </div>

      <TileIndex
        blocks={blocks}
        onHighlight={setHighlightedBlockId}
        highlightedId={highlightedBlockId}
        onClose={() => setIsIndexOpen(false)}
        isOpen={isIndexOpen}
        viewMode={viewMode}
      />
    </div>
  )
}
