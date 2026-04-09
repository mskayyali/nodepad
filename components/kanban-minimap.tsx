"use client"

import { motion } from "framer-motion"
import { type LucideIcon, FileText } from "lucide-react"

interface MinimapColumn {
  id: string
  title: string
  icon: LucideIcon
  count: number
}

interface KanbanMinimapProps {
  columns: MinimapColumn[]
  onColumnClick: (id: string) => void
}

export function KanbanMinimap({ columns, onColumnClick }: KanbanMinimapProps) {
  if (columns.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/10 backdrop-blur-md border border-white/5 shadow-xl transition-all hover:bg-black/20">
      {columns.map((col) => (
        <button
          key={col.id}
          onClick={() => onColumnClick(col.id)}
          className="group relative flex items-center justify-center h-8 w-8 rounded-md hover:bg-white/10 transition-all active:scale-95"
          title={col.title}
        >
          {(() => {
            const Icon = col.icon ?? FileText
            return <Icon className="h-4 w-4 text-foreground/60 group-hover:text-foreground transition-colors" />
          })()}
          
          {/* Indicator dot */}
          <div className="absolute -top-0.5 -right-0.5 h-3 w-3 flex items-center justify-center rounded-full bg-primary text-[7px] font-bold text-primary-foreground border-2 border-background scale-0 group-hover:scale-100 transition-transform">
            {col.count}
          </div>

          {/* Label Tooltip (Minimal) */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-popover text-[9px] font-mono text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border">
            {col.title.toUpperCase()}
          </div>
        </button>
      ))}
    </div>
  )
}
