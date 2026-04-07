"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CONTENT_TYPE_CONFIG } from "@/lib/content-types"
import type { TextBlock } from "@/components/tile-card"

interface TilingMinimapProps {
  pages: TextBlock[][]
  activePageIdx: number
  onPageClick: (idx: number) => void
}

export function TilingMinimap({ pages, activePageIdx, onPageClick }: TilingMinimapProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col items-center gap-1.5 p-1.5 rounded-lg bg-surface-raised backdrop-blur-md border border-border shadow-xl"
    >
      {pages.map((page, idx) => {
        const isActive = idx === activePageIdx

        return (
          <div key={idx} className="relative flex items-center">

            {/* Tooltip — slides in from the right, appears to the left of the button */}
            <AnimatePresence>
              {hoveredIdx === idx && (
                <motion.div
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="absolute right-full bottom-0 mr-2.5 w-52 p-2.5 rounded-md bg-surface-raised backdrop-blur-md border border-border shadow-2xl pointer-events-none z-50"
                >
                  <p className="font-mono text-[7px] uppercase tracking-widest text-muted-foreground pb-1.5 mb-1.5 border-b border-border/60">
                    Page {idx + 1} · {page.length} tile{page.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {page.map(block => {
                      const config = CONTENT_TYPE_CONFIG[block.contentType]
                      const title  = block.text.length > 48
                        ? block.text.slice(0, 48) + "…"
                        : block.text
                      return (
                        <div key={block.id} className="flex items-start gap-1.5">
                          <div
                            className="h-[5px] w-[5px] rounded-[1px] shrink-0 mt-[3px]"
                            style={{ background: config.accentVar, opacity: 0.85 }}
                          />
                          <span className="font-mono text-[9px] text-muted-foreground leading-snug">
                            {title}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Page button */}
            <button
              onClick={() => onPageClick(idx)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`group relative flex flex-col items-center gap-[4px] p-1.5 rounded-md transition-all duration-150 outline-none ${
                isActive
                  ? "bg-primary/15 border border-primary/40 shadow-[0_0_0_1px_var(--primary)]"
                  : "border border-border bg-surface-overlay hover:bg-surface-overlay-hover hover:border-border"
              }`}
            >
              {/* Dot grid — up to 3 columns, rows as needed */}
              <div className="grid grid-cols-3 gap-[3px]">
                {page.map(block => {
                  const config = CONTENT_TYPE_CONFIG[block.contentType]
                  return (
                    <div
                      key={block.id}
                      className="h-[5px] w-[5px] rounded-[1px] transition-opacity duration-150"
                      style={{
                        background: config.accentVar,
                        opacity: isActive ? 0.95 : 0.55,
                      }}
                    />
                  )
                })}
              </div>

              {/* Page number */}
              <span className={`font-mono text-[7px] font-bold leading-none transition-colors ${
                isActive ? "text-primary/80" : "text-muted-foreground/50 group-hover:text-foreground/60"
              }`}>
                {idx + 1}
              </span>
            </button>
          </div>
        )
      })}
    </motion.div>
  )
}
