"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, MessageSquare, Plus, Sparkles, X } from "lucide-react"

export interface GhostNote {
  id: string
  text: string
  category: string
  isGenerating: boolean
}

interface GhostPanelProps {
  ghostNotes: GhostNote[]
  isOpen: boolean
  onClose: () => void
  onClaim: (id: string) => void
  onDismiss: (id: string) => void
  onGenerate: (guidingThought?: string) => void
}

export function GhostPanel({ ghostNotes, isOpen, onClose, onClaim, onDismiss, onGenerate }: GhostPanelProps) {
  const isGenerating = ghostNotes.some(n => n.isGenerating)
  const isFull = ghostNotes.length >= 5
  const [guidingEnabled, setGuidingEnabled] = useState(false)
  const [guidingText, setGuidingText] = useState("")

  const handleGenerate = () => {
    onGenerate(guidingEnabled && guidingText.trim() ? guidingText.trim() : undefined)
  }
  return (
    <div
      style={{
        width: isOpen ? 272 : 0,
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? "visible" : "hidden",
      }}
      className="flex flex-col h-full bg-black/20 backdrop-blur-3xl border-l border-border shrink-0 overflow-hidden relative z-50 transition-all duration-200 ease-in-out"
    >
      <div className="w-[272px] flex flex-col h-full">
        {/* Header */}
        <div className="flex h-10 items-center justify-between border-b border-border bg-card/5 px-3 py-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-5 w-5 bg-primary/10 rounded-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-tight text-foreground/80 select-none">
              Synthesis
            </h3>
            {ghostNotes.length > 0 && (
              <span className="font-mono text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-sm font-bold tabular-nums">
                {ghostNotes.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || isFull}
              title={isFull ? "Panel full — dismiss a thesis first" : isGenerating ? "Generating…" : "Generate synthesis"}
              className="p-1 px-1.5 hover:bg-primary/10 rounded-sm transition-colors text-muted-foreground/30 hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1 px-1.5 hover:bg-white/5 rounded-sm transition-colors text-muted-foreground/30 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-3 px-3 space-y-3">
          {ghostNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3 opacity-25">
              <Sparkles className="h-5 w-5" />
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-center leading-relaxed">
                Emergent theses<br />will appear here
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {ghostNotes.map(note => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.2 }}
                  className="rounded-md border border-primary/20 bg-primary/5 p-3 flex flex-col gap-3"
                >
                  {/* Row: sparkles + category + dismiss */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-primary/50 shrink-0" />
                      {note.category && !note.isGenerating && (
                        <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
                          {note.category}
                        </span>
                      )}
                    </div>
                    {!note.isGenerating && (
                      <button
                        onClick={() => onDismiss(note.id)}
                        className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground/25 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Text / loading */}
                  {note.isGenerating ? (
                    <div className="flex items-center gap-2.5 py-1">
                      <div className="flex space-x-1">
                        <div className="h-1 w-1 animate-bounce rounded-full bg-primary/40 [animation-delay:-0.3s]" />
                        <div className="h-1 w-1 animate-bounce rounded-full bg-primary/40 [animation-delay:-0.15s]" />
                        <div className="h-1 w-1 animate-bounce rounded-full bg-primary/40" />
                      </div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40">
                        Synthesizing...
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] font-medium leading-relaxed text-foreground/75">
                      {note.text}
                    </p>
                  )}

                  {/* Add button */}
                  {!note.isGenerating && (
                    <button
                      onClick={() => onClaim(note.id)}
                      className="flex items-center gap-1.5 w-full justify-center rounded-sm bg-primary/15 hover:bg-primary/25 px-2.5 py-1.5 font-mono text-[9px] font-black uppercase tracking-wider text-primary transition-colors"
                    >
                      <Check className="h-3 w-3 stroke-[3px]" />
                      Add to canvas
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Guiding Thoughts + Generate */}
        <div className="border-t border-border/30 px-3 py-2.5 shrink-0 flex flex-col gap-2">
          {/* Checkbox toggle */}
          <button
            onClick={() => setGuidingEnabled(v => !v)}
            className="flex items-center gap-2 group w-full text-left"
          >
            <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
              guidingEnabled ? "border-primary bg-primary/20" : "border-white/15 group-hover:border-white/30"
            }`}>
              {guidingEnabled && <Check className="h-2.5 w-2.5 text-primary" />}
            </div>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-muted-foreground/40" />
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors">
                Guiding Thought
              </span>
            </div>
          </button>

          {/* Textarea — collapsible */}
          <AnimatePresence initial={false}>
            {guidingEnabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <textarea
                  value={guidingText}
                  onChange={e => setGuidingText(e.target.value)}
                  placeholder="e.g. Focus on tensions between technology and human agency..."
                  rows={3}
                  className="w-full resize-none rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/40 transition-colors leading-relaxed"
                  spellCheck={false}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || isFull}
            className="flex items-center gap-1.5 w-full justify-center rounded-sm bg-primary/15 hover:bg-primary/25 disabled:opacity-30 disabled:cursor-not-allowed px-2.5 py-1.5 font-mono text-[9px] font-black uppercase tracking-wider text-primary transition-colors"
          >
            {isGenerating ? (
              <>
                <div className="flex space-x-0.5">
                  <div className="h-1 w-1 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
                  <div className="h-1 w-1 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
                  <div className="h-1 w-1 animate-bounce rounded-full bg-primary/60" />
                </div>
                Synthesizing
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
