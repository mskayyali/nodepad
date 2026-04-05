"use client"

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react"
import { createPortal } from "react-dom"
import { X, Check, ArrowRight, Pin, RefreshCw, ChevronDown, ChevronRight, ChevronLeft, Link as LinkIcon, Sparkles, Tag } from "lucide-react"
import { motion } from "framer-motion"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types"

export interface TextBlock {
  id: string
  text: string
  timestamp: number
  contentType: ContentType
  category?: string
  isEnriching?: boolean
  statusText?: string
  isError?: boolean
  annotation?: string
  confidence?: number | null
  sources?: { url: string; title: string; siteName: string }[]
  influencedBy?: string[]
  isUnrelated?: boolean
  isPinned?: boolean
  subTasks?: { id: string; text: string; isDone: boolean; timestamp: number }[]
}

interface TileCardProps {
  block: TextBlock
  isCollapsed: boolean
  hideCollapse?: boolean       // tiling view — collapse doesn't work in BSP layout, so hide the button
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onEditAnnotation: (id: string, newAnnotation: string) => void
  onReEnrich: (id: string, newCategory?: string) => void
  onToggleCollapse: (id: string) => void
  onTogglePin?: (id: string) => void
  onToggleSubTask?: (blockId: string, subTaskId: string) => void
  onDeleteSubTask?: (blockId: string, subTaskId: string) => void
  isHighlighted?: boolean
  onHighlight?: (id: string | null) => void
  onConnectionHover?: (blockId: string | null) => void
  onConnectionLock?: (blockId: string) => void
  isConnectionLocked?: boolean
  allBlocks?: TextBlock[]
  onChangeType?: (id: string, newType: ContentType) => void
}

// Custom Markdown components for styling
const MarkdownComponents = {
  p: ({ children }: any) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }: any) => <ul className="mb-3 list-disc pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }: any) => <ol className="mb-3 list-decimal pl-4 last:mb-0">{children}</ol>,
  li: ({ children }: any) => <li className="mb-1">{children}</li>,
  h1: ({ children }: any) => <h1 className="mb-2 text-base font-bold">{children}</h1>,
  h2: ({ children }: any) => <h2 className="mb-2 text-base font-bold">{children}</h2>,
  h3: ({ children }: any) => <h3 className="mb-1 text-sm font-bold">{children}</h3>,
  a: ({ href, children }: any) => {
    let displayDomain = href
    try {
      displayDomain = new URL(href).hostname.replace("www.", "")
    } catch {}
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-primary hover:underline"
      >
        <LinkIcon className="h-2.5 w-2.5" />
        {children || displayDomain}
      </a>
    )
  },
  strong: ({ children }: any) => <strong className="font-bold text-foreground">{children}</strong>,
}

// Simple heuristic to detect RTL text (Arabic/Hebrew)
function isRTL(text: string): boolean {
  const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/
  return rtlChars.test(text)
}

export const TileCard = memo(function TileCard({ 
  block, 
  isCollapsed, 
  onDelete, 
  onEdit, 
  onEditAnnotation, 
  onReEnrich, 
  onToggleCollapse,
  onTogglePin,
  onToggleSubTask,
  onDeleteSubTask,
  isHighlighted,
  onHighlight,
  onConnectionHover,
  onConnectionLock,
  isConnectionLocked,
  allBlocks,
  hideCollapse = false,
  onChangeType,
}: TileCardProps) {
  // In tiling view, collapse is disabled — BSP layout can't redistribute freed space
  const effectiveCollapsed = hideCollapse ? false : isCollapsed
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(block.text)
  const [isHovered, setIsHovered] = useState(false)
  const [isEditingAnnotation, setIsEditingAnnotation] = useState(false)
  const [editAnnotation, setEditAnnotation] = useState(block.annotation || "")
  const [isMounted, setIsMounted] = useState(false)
  const [isFooterExpanded, setIsFooterExpanded] = useState(false)
  const [editingMinHeight, setEditingMinHeight] = useState<number | undefined>(undefined)
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false)
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null)
  const typeChangeButtonRef = useRef<HTMLButtonElement>(null)
  const typePickerDropdownRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const annotationRef = useRef<HTMLTextAreaElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const formattedTime = useMemo(() => {
    if (!isMounted) return ""
    return new Date(block.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [block.timestamp, isMounted])

  const config = CONTENT_TYPE_CONFIG[block.contentType]
  const Icon = config.icon
  const accent = config.accentVar
  const isTask = block.contentType === "task"

  // Auto-size + focus for the main text editing textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const el = textareaRef.current
      el.focus()
      el.selectionStart = el.value.length
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [isEditing])

  // Auto-size + focus for annotation editing textarea
  useEffect(() => {
    if (isEditingAnnotation && annotationRef.current) {
      const el = annotationRef.current
      el.focus()
      el.selectionStart = el.value.length
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [isEditingAnnotation])

  // Close type picker on outside click or Escape.
  // The dropdown renders in a portal so we check both the trigger button
  // and the floating dropdown div — anything outside both closes the picker.
  useEffect(() => {
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

  const handleSave = useCallback(() => {
    if (editText.trim() && editText !== block.text) {
      onEdit(block.id, editText)
    }
    setIsEditing(false)
    setEditingMinHeight(undefined)
  }, [editText, block.id, block.text, onEdit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSave()
      }
      if (e.key === "Escape") {
        setEditText(block.text)
        setIsEditing(false)
        setEditingMinHeight(undefined)
      }
    },
    [handleSave, block.text]
  )

  const handleAnnotationSave = useCallback(() => {
    onEditAnnotation(block.id, editAnnotation)
    setIsEditingAnnotation(false)
    setEditingMinHeight(undefined)
  }, [editAnnotation, block.id, onEditAnnotation])

  const handleAnnotationKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleAnnotationSave()
      }
      if (e.key === "Escape") {
        setEditAnnotation(block.annotation || "")
        setIsEditingAnnotation(false)
        setEditingMinHeight(undefined)
      }
    },
    [handleAnnotationSave, block.annotation]
  )

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (effectiveCollapsed) return
    const target = e.target as HTMLElement
    if (target.closest('a')) return
    // Capture current height before any state changes to prevent shrink during editing
    setEditingMinHeight(cardRef.current?.offsetHeight)
    if (target.closest('.annotation-area')) {
       setEditAnnotation(block.annotation || "")
       setIsEditingAnnotation(true)
       return
    }
    setEditText(block.text)
    setIsEditing(true)
  }, [block.text, block.annotation, effectiveCollapsed])

  const isTextRTL = useMemo(() => isRTL(block.text), [block.text])
  const isAnnotationRTL = useMemo(() => isRTL(block.annotation || ""), [block.annotation])

  const toggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleCollapse(block.id)
    if (isEditing) { setIsEditing(false); setEditingMinHeight(undefined) }
    if (isEditingAnnotation) { setIsEditingAnnotation(false); setEditingMinHeight(undefined) }
  }, [block.id, onToggleCollapse, isEditing, isEditingAnnotation])

  // Unified render structure
  return (
    <div
      ref={cardRef}
      className={`group relative flex h-full w-full flex-col overflow-hidden border transition-all duration-200 ${
        isHighlighted ? "z-10 scale-[1.002] border-primary/50 ring-2 ring-primary/20" : "border-border/50"
      } ${
        isTask ? "bg-[color-mix(in_oklch,var(--type-task)_8%,transparent)] border-[color-mix(in_oklch,var(--type-task)_25%,transparent)] shadow-[color-mix(in_oklch,var(--type-task)_8%,transparent)]" : "bg-card/30"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
      style={{
        borderLeft: isTask 
          ? `3px solid var(--type-task)` 
          : block.contentType === "thesis" 
            ? `3px solid ${accent}` 
            : block.isPinned 
              ? `3px solid ${accent}` 
              : `2px solid ${accent}`,
        borderRadius: isTask ? "var(--radius)" : "0",
        boxShadow: isTask
          ? "none"
          : block.contentType === "thesis"
            ? `0 0 20px rgba(255, 215, 0, 0.1), inset 0 1px 0 0 rgba(255,255,255,0.05)`
            : block.isPinned
              ? `0 0 15px color-mix(in oklch, ${accent} 20%, transparent), inset 0 1px 0 0 rgba(255,255,255,0.05)`
              : isEditing
                ? `0 0 0 1px ${accent}, inset 0 1px 0 0 rgba(255,255,255,0.04)`
                : isHovered
                  ? `inset 0 1px 0 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.2)`
                  : `inset 0 1px 0 0 rgba(255,255,255,0.03)`,
        outline: !isTask && isHighlighted ? `2px solid ${accent}` : "none",
        outlineOffset: isHighlighted ? "-2px" : "0",
        zIndex: isHighlighted ? 10 : "auto",
        minHeight: (isEditing || isEditingAnnotation) && editingMinHeight ? editingMinHeight : undefined
      }}
    >
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isTask
            ? `radial-gradient(circle at 0% 0%, var(--type-task), transparent 50%)`
            : block.isPinned 
              ? `radial-gradient(circle at 0% 0%, ${accent}, transparent 40%)`
              : `radial-gradient(ellipse at 10% 10%, ${accent}, transparent 70%)`,
          opacity: isTask ? 0.1 : block.contentType === "thesis" ? 0 : block.isPinned ? 0.08 : isHighlighted ? 0.15 : 0.04,
        }}
      />

      {/* Header */}
      <div
        className={`relative flex items-center justify-between px-3 py-2 flex-shrink-0 ${isTextRTL ? 'flex-row-reverse' : ''}`}
        style={{ 
          borderBottom: effectiveCollapsed ? "none" : "1px solid var(--border)",
          background: isTask
            ? "linear-gradient(to right, oklch(0.25 0.08 260), oklch(0.18 0.05 260))"
            : block.contentType === "thesis"
              ? "var(--thesis-gradient)"
              : block.isPinned
                ? `linear-gradient(to right, ${accent}, color-mix(in oklch, ${accent} 80%, white 10%))`
                : accent,
          color: isTask 
            ? "oklch(0.85 0.05 260)" 
            : block.contentType === "thesis" 
              ? "var(--thesis-foreground)" 
              : "black"
        }}
      >
        <div className={`flex items-center gap-2 overflow-hidden ${isTextRTL ? 'flex-row-reverse' : ''}`} style={{ color: "inherit" }}>
          {!hideCollapse && (
            <button
              onClick={toggleCollapse}
              className="flex-shrink-0 transition-transform hover:scale-110 active:scale-95"
              aria-label={effectiveCollapsed ? "Expand panel" : "Collapse panel"}
            >
              {effectiveCollapsed ? (
                isTextRTL ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className={`h-3 w-3 transition-transform ${block.isPinned ? "scale-110" : ""}`} />
              )}
            </button>
          )}

          {/* Type display — read-only label */}
          <Icon className="h-3 w-3 flex-shrink-0" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider truncate max-w-[200px]">
            {config.label}
          </span>

          {block.isUnrelated && !effectiveCollapsed && (
            <span className="ml-1 rounded-sm bg-black/10 px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-tighter text-black/60">
              Not related to topic
            </span>
          )}
        </div>
        <div className={`flex items-center gap-2 flex-shrink-0 ${isTextRTL ? 'flex-row-reverse' : ''}`} style={{ color: "inherit" }}>
          {block.influencedBy && block.influencedBy.length > 0 && (
            <button
              onMouseEnter={() => !isConnectionLocked && onConnectionHover?.(block.id)}
              onMouseLeave={() => !isConnectionLocked && onConnectionHover?.(null)}
              onClick={e => {
                e.stopPropagation()
                if (isConnectionLocked) {
                  onConnectionHover?.(null)
                }
                onConnectionLock?.(block.id)
              }}
              className={`flex items-center gap-[2.5px] transition-all duration-150 rounded-sm px-0.5 ${
                isConnectionLocked
                  ? "opacity-100 bg-black/20"
                  : "opacity-35 hover:opacity-90"
              }`}
              title={isConnectionLocked ? "Click to unlock connections" : `Show ${block.influencedBy.length} connection${block.influencedBy.length !== 1 ? 's' : ''} — click to lock`}
            >
              <div className="h-[5px] w-[5px] rounded-full bg-current" />
              <div className={`h-[3px] w-[3px] rounded-full bg-current ${isConnectionLocked ? "opacity-100" : "opacity-60"}`} />
              <div className="h-[5px] w-[5px] rounded-full bg-current" />
            </button>
          )}
          <span className="font-mono text-[10px] font-medium opacity-70">
            {formattedTime}
          </span>
          {!effectiveCollapsed && block.contentType === "thesis" && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReEnrich(block.id, "thesis")
              }}
              className="flex h-4 w-4 items-center justify-center rounded-sm transition-all hover:bg-black/20"
              title="Refresh thesis synthesis"
              disabled={block.isEnriching}
            >
              <RefreshCw className={`h-2.5 w-2.5 ${block.isEnriching ? "animate-spin opacity-50" : ""}`} />
            </button>
          )}
          {!effectiveCollapsed && onTogglePin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTogglePin(block.id)
              }}
              className={`flex h-4 w-4 items-center justify-center rounded-sm transition-all shadow-sm ${block.isPinned ? "bg-black/20 opacity-100 scale-110 !opacity-100" : "opacity-40 hover:opacity-100 hover:bg-black/10"}`}
              aria-label={block.isPinned ? "Unpin note" : "Pin note"}
              title={block.isPinned ? "Unpin note" : "Pin note"}
            >
              <Pin className={`h-2.5 w-2.5 transition-transform ${block.isPinned ? "fill-current" : "-rotate-45"}`} />
            </button>
          )}
          {/* Change-type button — portal dropdown, clear of tile overflow:hidden */}
          {onChangeType && !effectiveCollapsed && (
            <button
              ref={typeChangeButtonRef}
              onClick={e => {
                e.stopPropagation()
                if (typeChangeButtonRef.current) {
                  setPickerRect(typeChangeButtonRef.current.getBoundingClientRect())
                }
                setIsTypePickerOpen(v => !v)
              }}
              className={`flex h-4 w-4 items-center justify-center rounded-sm transition-all ${isTypePickerOpen ? "bg-black/20 opacity-100" : "opacity-40 hover:opacity-100 hover:bg-black/10"}`}
              title="Change type"
            >
              <Tag className="h-2.5 w-2.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(block.id)
            }}
            className="flex h-4 w-4 items-center justify-center rounded-sm transition-all hover:bg-black/10"
            aria-label="Delete note"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* Type picker — rendered via portal so it escapes tile overflow:hidden */}
      {isTypePickerOpen && pickerRect && onChangeType && isMounted && createPortal(
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
                    onClick={() => {
                      onChangeType(block.id, type)
                      setIsTypePickerOpen(false)
                    }}
                    className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-all hover:bg-secondary/60 ${isActive ? "bg-secondary/80" : ""}`}
                  >
                    <TypeIcon className="h-3 w-3 flex-shrink-0" style={{ color: cfg.accentVar }} />
                    <span
                      className="font-mono text-[10px] uppercase tracking-wide"
                      style={{ color: isActive ? cfg.accentVar : undefined }}
                    >
                      {cfg.label}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>,
        document.body
      )}

      {effectiveCollapsed && (
        <div className="flex-1 px-3 py-1.5 overflow-hidden">
          <p className="text-[11px] leading-relaxed font-medium text-foreground/50 line-clamp-2 italic">
            {block.text}
          </p>
        </div>
      )}

      {!effectiveCollapsed && (
        <div className="flex flex-1 flex-col overflow-hidden">
            {/* Body */}
            <div
              className={`flex-1 flex flex-col overflow-y-auto overflow-x-hidden p-3 custom-scrollbar ${isTextRTL ? 'rtl-text' : ''}`}
            >
              <div className="flex flex-col min-h-full">
                {isEditing ? (
                  <div className="flex w-full flex-col gap-2">
                    <textarea
                      ref={textareaRef}
                      value={editText}
                      onChange={(e) => {
                        setEditText(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = e.target.scrollHeight + 'px'
                      }}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSave}
                      className={`w-full resize-none rounded-sm bg-secondary/30 px-2 py-1.5 text-base font-bold leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 ${isTextRTL ? 'rtl-text' : ''}`}
                      style={{ minHeight: "3rem" }}
                    />
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        Enter ↵ save · Shift+Enter newline · Esc cancel
                      </span>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSave()
                        }}
                        className="ml-auto flex h-5 w-5 items-center justify-center rounded-sm transition-transform active:scale-95"
                        style={{ background: accent, color: "var(--background)" }}
                        aria-label="Save edit"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    {block.isError && (
                      <div className="mb-3 flex items-start gap-2 rounded-sm border border-red-500/20 bg-red-500/10 px-2.5 py-2">
                        <span className="mt-px font-mono text-[9px] text-red-400/80 uppercase tracking-wider leading-relaxed">
                          {block.statusText === "no-api-key"
                            ? <>AI enrichment failed — no API key. Open the <strong className="text-red-300">☰ sidebar → Settings</strong> to add your API key.</>
                            : "Enrichment failed. Double-click to retry."}
                        </span>
                      </div>
                    )}
                    <div className={block.isEnriching ? "shimmer-body" : ""}>
                      {isTask && block.subTasks ? (
                        <div className="flex flex-col gap-2">
                          {block.subTasks.map(st => (
                            <div key={st.id} className="group/task flex items-start gap-3 rounded-md bg-white/5 p-2 transition-colors hover:bg-white/10">
                              <button
                                onClick={() => onToggleSubTask?.(block.id, st.id)}
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all`} style={{ backgroundColor: st.isDone ? 'var(--type-task)' : 'transparent', borderColor: st.isDone ? 'var(--type-task)' : 'color-mix(in oklch, var(--type-task) 50%, transparent)' }}
                              >
                                {st.isDone && <Check className="h-3 w-3 text-white" />}
                              </button>
                              <span className={`flex-1 text-sm leading-relaxed transition-all ${st.isDone ? 'text-foreground/40 line-through' : 'text-foreground'}`}>
                                {st.text}
                              </span>
                              <button
                                onClick={() => {
                                  if (confirm("Delete this task?")) {
                                    onDeleteSubTask?.(block.id, st.id)
                                  }
                                }}
                                className="opacity-0 group-hover/task:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                              >
                                <X className="h-3 w-3 text-red-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        renderBody(block.text, config.bodyStyle, accent)
                      )}
                    </div>
                  </div>
                )}
                
                {/* Annotation */}
                {!isEditing && (block.annotation || isEditingAnnotation) && (
                  <div className={`annotation-area mt-3 border-t border-border/40 pt-3 flex flex-col ${isEditingAnnotation ? 'flex-1' : ''}`}>
                    {isEditingAnnotation ? (
                        <div className="flex flex-1 w-full flex-col gap-2">
                          <textarea
                            ref={annotationRef}
                            value={editAnnotation}
                            onChange={(e) => setEditAnnotation(e.target.value)}
                            onKeyDown={handleAnnotationKeyDown}
                            onBlur={handleAnnotationSave}
                            className={`flex-1 w-full resize-none rounded-md bg-secondary/20 px-3 py-3 text-sm leading-relaxed text-foreground border border-border/20 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:bg-secondary/30 transition-colors ${isAnnotationRTL ? 'rtl-text' : ''}`}
                            placeholder="Start writing..."
                          />
                          <div className="flex items-center justify-between px-1">
                            <span className="font-mono text-[10px] text-muted-foreground/60">
                              Enter ↵ save · Shift+Enter newline · Esc cancel
                            </span>
                            <span className="font-mono text-[9px] text-primary font-bold uppercase tracking-widest opacity-80">Markdown Editor</span>
                          </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                          <div className={`prose-sm prose-invert max-w-none text-[13px] leading-relaxed text-foreground/80 ${block.isEnriching ? "shimmer-body" : ""} ${isAnnotationRTL ? 'rtl-text' : ''}`}>
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={MarkdownComponents as any}
                            >
                              {block.annotation || ""}
                            </ReactMarkdown>
                          </div>
                        </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Confidence bar */}
            {block.confidence !== undefined && block.confidence !== null && !isEditing && (
              <div className={`px-3 pb-2 flex-shrink-0 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[9px] text-muted-foreground">Confidence</span>
                  <span className="font-mono text-[9px] text-muted-foreground">{Math.round(block.confidence)}%</span>
                </div>
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(5, block.confidence)}%`,
                      background: accent,
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Sources */}
            {!isEditing && block.sources && block.sources.length > 0 && (
              <div className="px-3 pb-3 flex flex-col gap-1 flex-shrink-0">
                {block.sources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/source flex items-center justify-between rounded-sm border border-border/50 bg-secondary/30 px-2 py-1.5 transition-colors hover:bg-secondary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate text-[11px] text-foreground/90 group-hover/source:text-foreground">
                        {source.title}
                      </span>
                      <span className="truncate font-mono text-[9px] text-muted-foreground">
                        {source.siteName}
                      </span>
                    </div>
                    <div className="rotate-[-45deg] text-muted-foreground transition-transform group-hover/source:translate-x-[1px] group-hover/source:translate-y-[-1px] group-hover/source:text-foreground">
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* Footer */}
            <div
              ref={footerRef}
              className={`relative flex flex-shrink-0 flex-col transition-all duration-300 ease-in-out ${
                isFooterExpanded ? "bg-secondary/40" : "bg-black/25"
              }`}
              style={{
                borderTop: "1px solid var(--border)",
              }}
            >
              <div className={`flex items-start justify-between px-3 py-2 ${isFooterExpanded ? 'gap-3' : 'items-center'}`}>
                <div className={`flex flex-1 items-start gap-2 overflow-hidden ${isFooterExpanded ? 'flex-wrap' : ''}`}>
                  <div className={`flex items-start gap-2 overflow-hidden ${isFooterExpanded ? 'flex-wrap mb-1' : ''}`}>
                    {/* Category tag — read-only, updated by AI on enrichment */}
                    <span
                      className="rounded-sm px-2 py-0.5 font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-sm shrink-0"
                      style={{
                        background: `color-mix(in oklch, ${accent} 35%, transparent)`,
                        color: "white",
                        border: `1px solid color-mix(in oklch, ${accent} 50%, transparent)`
                      }}
                    >
                      <span className="opacity-70">#</span>
                      <span className="truncate max-w-[120px]">{block.category || "no-topic"}</span>
                    </span>

                    {block.influencedBy && block.influencedBy.length > 0 && (
                      <div className="group/influences relative">
                        <div
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20 cursor-help transition-all hover:bg-primary/20"
                          onMouseEnter={() => block.influencedBy?.forEach(id => onHighlight?.(id))}
                          onMouseLeave={() => block.influencedBy?.forEach(() => onHighlight?.(null))}
                        >
                          <Sparkles className="h-2.5 w-2.5 text-primary" />
                          <span className="font-mono text-[9px] font-bold text-primary uppercase tracking-tighter">
                            {block.influencedBy.length} {block.influencedBy.length === 1 ? 'Link' : 'Links'}
                          </span>
                        </div>

                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full left-0 mb-2 w-56 p-2 rounded-sm bg-black/90 backdrop-blur-md border border-white/10 shadow-xl opacity-0 translate-y-2 pointer-events-none group-hover/influences:opacity-100 group-hover/influences:translate-y-0 transition-all z-[100]">
                          <h5 className="font-mono text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 border-b border-white/5 pb-1">Connected nodes</h5>
                          <div className="flex flex-col gap-1">
                            {block.influencedBy.slice(0, 5).map((id, i) => {
                              const linked = allBlocks?.find(b => b.id === id)
                              return (
                                <div key={i} className="flex items-start gap-2 overflow-hidden">
                                  <div className="h-1 w-1 rounded-full bg-primary shrink-0 mt-1" />
                                  <span className="font-mono text-[9px] text-foreground/70 truncate leading-tight">
                                    {linked ? linked.text.substring(0, 48) + (linked.text.length > 48 ? '…' : '') : `#${id.slice(0, 8)}`}
                                  </span>
                                </div>
                              )
                            })}
                            {block.influencedBy.length > 5 && (
                              <span className="font-mono text-[8px] text-muted-foreground/50 mt-1">+{block.influencedBy.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {block.influencedBy && block.influencedBy.length > 1 && (
                    <button
                      onClick={() => setIsFooterExpanded(!isFooterExpanded)}
                      className={`rounded-sm p-1 transition-all ${isFooterExpanded ? 'bg-primary/20 text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground/60'}`}
                    >
                      {isFooterExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 rotate-[-90deg]" />}
                    </button>
                  )}
                  
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-secondary/30 border border-border/20 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-20"}`}>
                    <span className="font-mono text-[8px] text-muted-foreground/50 uppercase tracking-[0.1em]">Node ID:</span>
                    <span className="font-mono text-[10px] text-muted-foreground/80 font-bold">#{block.id.slice(0, 6)}</span>
                  </div>
                </div>
              </div>
            </div>
        </div>
      )}
    </div>
  )
})

// Finds bare https?:// URLs in plain text and returns React nodes with
// clickable <a> links mixed into the surrounding text.
function linkifyText(text: string): React.ReactNode {
  const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g
  const parts: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = URL_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    // Strip trailing punctuation that's unlikely part of the URL
    const raw = m[0].replace(/[.,;:!?)>\]]+$/, "")
    let domain = raw
    try { domain = new URL(raw).hostname.replace("www.", "") } catch {}
    parts.push(
      <a
        key={m.index}
        href={raw}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
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

function renderBody(
  text: string,
  bodyStyle: string | undefined,
  accent: string
) {
  switch (bodyStyle) {
    case "blockquote":
      return (
        <div
          className="pl-3"
          style={{ borderLeft: `2px solid ${accent}`, opacity: 0.9 }}
        >
          <p className="text-base italic leading-relaxed text-foreground">
            {linkifyText(text)}
          </p>
        </div>
      )
    case "italic":
      return (
        <p className="text-base italic font-bold leading-relaxed text-foreground">
          {linkifyText(text)}
        </p>
      )
    case "muted-italic":
      return (
        <p className="text-base italic font-bold leading-relaxed text-muted-foreground">
          {linkifyText(text)}
        </p>
      )
    case "checkbox": {
      const isDone = text.toLowerCase().startsWith("[x]")
      const displayText = text.replace(/^\[[\sx]?\]\s*/i, "").replace(/^(todo|fixme|hack)\s*/i, "")
      return (
        <div className={`flex items-start gap-2 ${isRTL(text) ? 'flex-row-reverse' : ''}`}>
          <div
            className="mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border"
            style={{
              borderColor: accent,
              background: isDone ? accent : "transparent",
            }}
          >
            {isDone && <Check className="h-2.5 w-2.5" style={{ color: "var(--background)" }} />}
          </div>
          <p
            className="text-sm font-bold leading-relaxed text-foreground"
            style={{
              textDecoration: isDone ? "line-through" : "none",
              opacity: isDone ? 0.6 : 1,
            }}
          >
            {linkifyText(displayText)}
          </p>
        </div>
      )
    }
    case "thesis":
      return (
        <div className="flex flex-col gap-4">
          <p className="text-lg font-medium leading-relaxed tracking-tight text-foreground prose-invert">
            {linkifyText(text)}
          </p>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        </div>
      )
    default:
      return (
        <p className="text-base font-bold leading-relaxed text-foreground">
          {linkifyText(text)}
        </p>
      )
  }
}
