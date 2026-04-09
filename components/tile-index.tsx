"use client"

import { useMemo } from "react"
import { TextBlock } from "@/components/tile-card"
import { X, LayoutList, CheckSquare, Sparkles, HelpCircle, FileText } from "lucide-react"
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types"

interface TileIndexProps {
  blocks: TextBlock[]
  onHighlight: (id: string | null) => void
  highlightedId: string | null
  onClose?: () => void
  isOpen: boolean
  viewMode: "tiling" | "kanban" | "graph"
}

export function TileIndex({ blocks, onHighlight, highlightedId, onClose, isOpen, viewMode }: TileIndexProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "task": return <CheckSquare className="h-3 w-3 text-indigo-400" />
      case "thesis": return <Sparkles className="h-3 w-3 text-yellow-400" />
      case "question": return <HelpCircle className="h-3 w-3 text-blue-400" />
      default: return <FileText className="h-3 w-3 text-muted-foreground/40" />
    }
  }

  // TILING MODE: Group by category for cleaner index
  const categories = useMemo(() => {
    const cats: Record<string, TextBlock[]> = {}
    blocks.forEach(b => {
      const cat = b.category || "General"
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(b)
    })
    return Object.entries(cats).sort((a, b) => a[0].localeCompare(b[0]))
  }, [blocks])

  // KANBAN MODE: Derived columns for direct board jumping
  const kanbanColumns = useMemo(() => {
    const cols: Set<string> = new Set()
    blocks.forEach(b => {
      if (b.isEnriching) cols.add("processing")
      else if (b.contentType === "task") cols.add("task")
      else cols.add(b.contentType || "general")
    })
    return Array.from(cols).map(type => {
      const config = CONTENT_TYPE_CONFIG[type as ContentType] || CONTENT_TYPE_CONFIG.general
      return { id: type, label: config.label, icon: config.icon ?? FileText }
    })
  }, [blocks])

  const scrollToTile = (id: string) => {
    const el = document.getElementById(`tile-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      onHighlight(id)
      setTimeout(() => onHighlight(null), 1500)
    }
  }

  const scrollToColumn = (key: string) => {
    const el = document.getElementById(`kanban-col-${key}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }
  }

  return (
    <div 
      style={{ 
        width: isOpen ? 240 : 0,
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? "visible" : "hidden"
      }}
      className="flex flex-col h-full bg-black/20 backdrop-blur-3xl border-l border-border shrink-0 overflow-hidden relative z-50 transition-all duration-200 ease-in-out"
    >
      <div className="w-[240px] flex flex-col h-full">
        {/* Header */}
        <div className="flex h-10 items-center justify-between border-b border-border bg-card/5 backdrop-blur-md px-3 py-1.5 shrink-0">
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 px-1.5 hover:bg-white/5 rounded-sm transition-colors text-muted-foreground/30 hover:text-white"
              title="Close Index"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          
          <div className="flex items-center gap-2.5">
            <h3 className="font-mono text-xs font-bold uppercase tracking-tight text-foreground/80 select-none text-right">
              {viewMode === "kanban" ? "Board Index" : "Canvas Index"}
            </h3>
            <div className="flex items-center justify-center h-5 w-5 bg-primary/10 rounded-sm transition-colors group-hover:bg-primary/20 scale-x-[-1]">
              <LayoutList className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-2 px-2 space-y-4">
          {viewMode === "kanban" ? (
            <div className="space-y-1">
               <h4 className="px-2.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">Columns</h4>
               {kanbanColumns.map(col => (
                 <button
                    key={col.id}
                    onClick={() => scrollToColumn(col.id)}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2.5 rounded-sm transition-all hover:bg-white/5 text-left text-foreground/60 hover:text-foreground group"
                 >
                   <col.icon className="h-3 w-3 text-primary/40 group-hover:text-primary transition-colors" />
                   <span className="font-mono text-[11px] font-bold uppercase tracking-tight">{col.label}</span>
                 </button>
               ))}
            </div>
          ) : (
            categories.map(([cat, catBlocks]) => (
              <div key={cat} className="space-y-1">
                <h4 className="px-2.5 text-[8px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest mb-1">{cat}</h4>
                {catBlocks.map(block => (
                   <button
                    key={block.id}
                    onMouseEnter={() => onHighlight(block.id)}
                    onMouseLeave={() => onHighlight(null)}
                    onClick={() => scrollToTile(block.id)}
                    className={`flex items-start gap-2.5 w-full px-2.5 py-2 rounded-sm transition-all hover:bg-white/5 text-left group border-r-2 ${
                      highlightedId === block.id 
                        ? "bg-primary/10 border-primary shadow-[inset_0_1px_0px_rgba(255,255,255,0.05)]" 
                        : "border-transparent text-foreground/60 hover:text-foreground"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0 transition-transform group-hover:scale-110">
                      {getIcon(block.contentType)}
                    </div>
                    <span className="font-mono text-[10px] font-bold truncate leading-tight">
                      {block.text.substring(0, 35) || "Empty note"}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
