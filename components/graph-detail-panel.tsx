"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types"
import type { TextBlock } from "@/components/tile-card"
import { Link as LinkIcon, Pin, RefreshCw, Tag, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const AnnotationMarkdownComponents = {
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
    >
      <LinkIcon className="h-2.5 w-2.5 shrink-0" />
      {children}
    </a>
  ),
  p: ({ children }: any) => <span>{children}</span>,
}

// Inline URL linkifier — identical logic to tile-card.tsx
function linkifyText(text: string): React.ReactNode {
  const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g
  const parts: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const raw = m[0].replace(/[.,;:!?)>\]]+$/, "")
    let domain = raw
    try { domain = new URL(raw).hostname.replace("www.", "") } catch {}
    parts.push(
      <a
        key={m.index}
        href={raw}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline"
      >
        <LinkIcon className="h-2.5 w-2.5 shrink-0" />
        {domain}
      </a>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 0 ? text : parts
}

interface GraphDetailPanelProps {
  block: TextBlock | null
  allBlocks: TextBlock[]
  onClose: () => void
  onSelectNode: (id: string) => void
  onReEnrich: (id: string, newCategory?: string) => void
  onChangeType: (id: string, newType: ContentType) => void
  onTogglePin: (id: string) => void
  onEdit: (id: string, text: string) => void
  onEditAnnotation: (id: string, annotation: string) => void
}

export function GraphDetailPanel({
  block,
  allBlocks,
  onClose,
  onSelectNode,
  onReEnrich,
  onChangeType,
  onTogglePin,
  onEdit,
  onEditAnnotation,
}: GraphDetailPanelProps) {
  const [editingText, setEditingText] = React.useState(false)
  const [editingAnnotation, setEditingAnnotation] = React.useState(false)
  const [draftText, setDraftText] = React.useState("")
  const [draftAnnotation, setDraftAnnotation] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const annotationRef = React.useRef<HTMLTextAreaElement>(null)
  const [isTypePickerOpen, setIsTypePickerOpen] = React.useState(false)
  const [pickerRect, setPickerRect] = React.useState<DOMRect | null>(null)
  const typeChangeButtonRef = React.useRef<HTMLButtonElement>(null)
  const typePickerDropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isTypePickerOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsTypePickerOpen(false) }
    const handleMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        !typeChangeButtonRef.current?.contains(t) &&
        !typePickerDropdownRef.current?.contains(t)
      ) {
        setIsTypePickerOpen(false)
      }
    }
    window.addEventListener("keydown", handleKey)
    document.addEventListener("mousedown", handleMouseDown)
    return () => {
      window.removeEventListener("keydown", handleKey)
      document.removeEventListener("mousedown", handleMouseDown)
    }
  }, [isTypePickerOpen])

  // Reset edit state when block changes
  React.useEffect(() => {
    setEditingText(false)
    setEditingAnnotation(false)
  }, [block?.id])

  // Auto-focus textarea when editing starts
  React.useEffect(() => {
    if (editingText) {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    }
  }, [editingText])

  React.useEffect(() => {
    if (editingAnnotation) {
      annotationRef.current?.focus()
      annotationRef.current?.select()
    }
  }, [editingAnnotation])

  if (!block) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center border-l border-border/60 bg-card/60">
        <div className="flex items-center gap-0.5 opacity-20">
          <span className="inline-block h-2 w-2 rounded-sm bg-foreground" />
          <span className="inline-block h-2 w-2 rounded-sm bg-foreground opacity-60" />
          <span className="inline-block h-2 w-2 rounded-sm bg-foreground opacity-30" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40">
          Select a node to inspect
        </p>
      </div>
    )
  }

  const config = CONTENT_TYPE_CONFIG[block.contentType]
  const Icon   = config.icon
  const accent = config.accentVar

  // Header colour — same logic as tile-card
  const headerBg = block.contentType === "thesis"
    ? "var(--thesis-gradient)"
    : block.isPinned
      ? `linear-gradient(to right, ${accent}, color-mix(in oklch, ${accent} 80%, white 10%))`
      : accent
  const headerColor = block.contentType === "thesis" ? "var(--thesis-foreground)" : "black"

  const connectedBlocks = allBlocks.filter(
    b => b.id !== block.id && (
      block.influencedBy?.includes(b.id) ||
      b.influencedBy?.includes(block.id)
    )
  )

  const date = new Date(block.timestamp).toLocaleDateString([], {
    month: "short", day: "numeric", year: "numeric",
  })

  const commitText = () => {
    const trimmed = draftText.trim()
    if (trimmed && trimmed !== block.text) onEdit(block.id, trimmed)
    setEditingText(false)
  }

  const commitAnnotation = () => {
    const trimmed = draftAnnotation.trim()
    if (trimmed !== (block.annotation ?? "")) onEditAnnotation(block.id, trimmed)
    setEditingAnnotation(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-border/60 bg-card">

      {/* ── Header bar — matches tile-card style ───────────────────────── */}
      <div
        className="flex flex-shrink-0 items-center justify-between px-3 py-2"
        style={{ background: headerBg, color: headerColor, borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 overflow-hidden" style={{ color: "inherit" }}>
          {/* Type display — read-only label; shimmer while enriching */}
          <Icon className="h-3 w-3 flex-shrink-0" />
          <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${block.isEnriching ? "shimmer-text" : ""}`}>
            {config.label}
          </span>
          {/* Category tag — read-only, updated by AI on enrichment */}
          <span className="rounded-sm bg-black/10 px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-tighter opacity-60">
            #{block.category || "no-topic"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: "inherit" }}>
          <span className="font-mono text-[9px] opacity-60">{date}</span>
          {/* Change-type button — portal dropdown, clear of panel overflow:hidden */}
          <button
            ref={typeChangeButtonRef}
            onClick={() => {
              if (typeChangeButtonRef.current) {
                setPickerRect(typeChangeButtonRef.current.getBoundingClientRect())
              }
              setIsTypePickerOpen(v => !v)
            }}
            className={`p-1 rounded-sm transition-opacity ${isTypePickerOpen ? "opacity-100 bg-black/20" : "opacity-40 hover:opacity-90"}`}
            title="Change type"
          >
            <Tag className="h-3 w-3" />
          </button>
          <button
            onClick={() => onTogglePin(block.id)}
            className={`p-1 rounded-sm transition-opacity ${block.isPinned ? "opacity-100" : "opacity-40 hover:opacity-90"}`}
            title={block.isPinned ? "Unpin" : "Pin"}
          >
            <Pin className="h-3 w-3" />
          </button>
          <button
            onClick={() => onReEnrich(block.id)}
            className="p-1 rounded-sm opacity-40 hover:opacity-90 transition-opacity"
            title="Re-enrich"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-sm opacity-40 hover:opacity-90 transition-opacity"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Note text — double-click to edit */}
        <div className="px-4 pt-4 pb-3">
          {editingText ? (
            <textarea
              ref={textareaRef}
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              onBlur={commitText}
              onKeyDown={e => {
                if (e.key === "Escape") { setEditingText(false) }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitText()
              }}
              rows={4}
              className={`w-full resize-none rounded-sm bg-secondary/30 px-2 py-1.5 text-base font-bold leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 border border-primary/30`}
            />
          ) : (
            <p
              className={`text-base font-bold leading-relaxed text-foreground cursor-text hover:bg-secondary/20 rounded-sm px-2 py-1 -mx-2 transition-colors ${block.isEnriching ? "shimmer-text" : ""}`}
              onDoubleClick={() => { setDraftText(block.text); setEditingText(true) }}
              title="Double-click to edit"
            >
              {linkifyText(block.text)}
            </p>
          )}
        </div>

        {/* Confidence bar */}
        {block.confidence != null && (
          <div className="px-4 pb-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">Confidence</span>
              <span className="font-mono text-[10px] font-bold" style={{ color: accent }}>{block.confidence}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${block.confidence}%`, background: accent }} />
            </div>
          </div>
        )}

        {/* Separator */}
        {block.annotation && <div className="mx-4 h-px bg-border/40 mb-3" />}

        {/* Annotation — double-click to edit */}
        {(block.annotation || editingAnnotation) && (
          <div className="px-4 pb-3 space-y-1.5">
            {editingAnnotation ? (
              <textarea
                ref={annotationRef}
                value={draftAnnotation}
                onChange={e => setDraftAnnotation(e.target.value)}
                onBlur={commitAnnotation}
                onKeyDown={e => {
                  if (e.key === "Escape") setEditingAnnotation(false)
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commitAnnotation()
                }}
                rows={5}
                className="w-full resize-none rounded-sm bg-secondary/20 px-2 py-1.5 text-sm leading-relaxed text-foreground border border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            ) : (
              <div
                className="text-sm leading-relaxed text-muted-foreground cursor-text hover:bg-secondary/20 rounded-sm px-2 py-1 -mx-2 transition-colors border-l-2 pl-3"
                style={{ borderColor: accent + "60" }}
                onDoubleClick={() => { setDraftAnnotation(block.annotation ?? ""); setEditingAnnotation(true) }}
                title="Double-click to edit"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={AnnotationMarkdownComponents as any}
                >
                  {block.annotation ?? ""}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Connected nodes */}
        {connectedBlocks.length > 0 && (
          <div className="px-4 pb-4 space-y-1.5">
            <div className="h-px bg-border/40 mb-3" />
            <div className="space-y-1">
              {connectedBlocks.map(b => {
                const bConfig = CONTENT_TYPE_CONFIG[b.contentType]
                const BIcon   = bConfig.icon
                return (
                  <button
                    key={b.id}
                    onClick={() => onSelectNode(b.id)}
                    className="flex w-full items-start gap-2.5 rounded-sm bg-secondary/30 px-2.5 py-2 text-left hover:bg-secondary/60 transition-colors group"
                  >
                    <BIcon className="mt-0.5 h-3 w-3 flex-shrink-0" style={{ color: bConfig.accentVar }} />
                    <span className="text-xs text-muted-foreground group-hover:text-foreground line-clamp-2 leading-relaxed transition-colors">
                      {b.text}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Type picker — portal so it escapes the panel's overflow:hidden */}
      {isTypePickerOpen && pickerRect && createPortal(
        <div
          ref={typePickerDropdownRef}
          className="rounded-md border border-border bg-card shadow-xl"
          style={{
            position: "fixed",
            top: pickerRect.bottom + 4,
            right: window.innerWidth - pickerRect.right,
            minWidth: 210,
            zIndex: 9999,
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <p className="px-2.5 pt-2 pb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
            Change type
          </p>
          <div className="grid grid-cols-2 gap-px p-1.5 pt-0">
            {(Object.entries(CONTENT_TYPE_CONFIG) as [ContentType, typeof CONTENT_TYPE_CONFIG[ContentType]][])
              .filter(([t]) => t !== "thesis")
              .map(([type, cfg]) => {
                const TypeIcon = cfg.icon
                const isActive = block.contentType === type
                return (
                  <button
                    key={type}
                    onClick={() => { onChangeType(block.id, type); setIsTypePickerOpen(false) }}
                    className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-all hover:bg-secondary/60 ${isActive ? "bg-secondary/80" : ""}`}
                  >
                    <TypeIcon className="h-3 w-3 flex-shrink-0" style={{ color: cfg.accentVar }} />
                    <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: isActive ? cfg.accentVar : undefined }}>
                      {cfg.label}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
