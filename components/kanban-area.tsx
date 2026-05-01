"use client"

import { useMemo, useRef, useCallback, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TileCard, type TextBlock } from "@/components/tile-card"
import { Sparkles, CheckSquare, Clock } from "lucide-react"
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types"
import { getRelatedIds, useModKey } from "@/lib/utils"
import { KanbanMinimap } from "./kanban-minimap"

interface KanbanAreaProps {
  blocks: TextBlock[]
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onEditAnnotation: (id: string, newAnnotation: string) => void
  onReEnrich: (id: string, newCategory?: string) => void
  onChangeType: (id: string, newType: import("@/lib/content-types").ContentType) => void
  onToggleCollapse: (id: string) => void
  onTogglePin: (id: string) => void
  onToggleSubTask: (id: string, subTaskId: string) => void
  onDeleteSubTask: (id: string, subTaskId: string) => void
  collapsedIds: Set<string>
  workspaces?: { id: string; name: string }[]
  activeWorkspaceId?: string
  onMoveToWorkspace?: (blockId: string, targetWorkspaceId: string) => void
  onCopyToWorkspace?: (blockId: string, targetWorkspaceId: string) => void
}

export function KanbanArea({
  blocks,
  onDelete,
  onEdit,
  onEditAnnotation,
  onReEnrich,
  onChangeType,
  onToggleCollapse,
  onTogglePin,
  onToggleSubTask,
  onDeleteSubTask,
  collapsedIds,
  workspaces,
  activeWorkspaceId,
  onMoveToWorkspace,
  onCopyToWorkspace,
}: KanbanAreaProps) {
  const mod = useModKey()
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null)
  const [lockedConnectionId, setLockedConnectionId] = useState<string | null>(null)

  const activeConnectionId = lockedConnectionId ?? hoveredConnectionId

  const relatedIds = useMemo<Set<string>>(
    () => activeConnectionId ? getRelatedIds(activeConnectionId, blocks) : new Set(),
    [activeConnectionId, blocks]
  )

  const handleConnectionHover = useCallback((id: string | null) => {
    setHoveredConnectionId(id)
  }, [])

  const handleConnectionLock = useCallback((id: string) => {
    setLockedConnectionId(prev => prev === id ? null : id)
  }, [])

  // Group blocks into columns by ContentType
  const columns = useMemo(() => {
    const cols: Record<string, { title: string; icon: any; blocks: TextBlock[] }> = {
      processing: { title: "Enriching", icon: Clock, blocks: [] },
      task: { title: "Tasks", icon: CheckSquare, blocks: [] },
      thesis: { title: "Thesis", icon: Sparkles, blocks: [] }
    }

    blocks.forEach(block => {
      if (block.isEnriching) {
        cols.processing.blocks.push(block)
      } else {
        const type = block.contentType || "general"
        if (!cols[type]) {
          const config = CONTENT_TYPE_CONFIG[type as ContentType] || CONTENT_TYPE_CONFIG.general
          cols[type] = { title: config.label, icon: config.icon, blocks: [] }
        }
        cols[type].blocks.push(block)
      }
    })

    return Object.entries(cols)
      .filter(([_, col]) => col.blocks.length > 0)
      .sort(([keyA], [keyB]) => {
        // Priority: task > thesis > processing > rest
        const order = ["task", "thesis", "processing"]
        const idxA = order.indexOf(keyA)
        const idxB = order.indexOf(keyB)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        return keyA.localeCompare(keyB)
      })
  }, [blocks])

  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToColumn = useCallback((key: string) => {
    const el = document.getElementById(`kanban-col-${key}`)
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }
  }, [])

  const minimapColumns = useMemo(() => {
    return columns.map(([key, col]) => ({
      id: key,
      title: col.title,
      icon: col.icon,
      count: col.blocks.length
    }))
  }, [columns])

  return (
    <div className="relative h-full w-full bg-[#050505] overflow-hidden">
      {/* Scrollable Container */}
      <div 
        ref={containerRef}
        className="flex h-full w-full overflow-x-auto custom-scrollbar p-6 pb-6 gap-8"
      >
        <AnimatePresence mode="popLayout">
          {columns.map(([key, col]) => (
            <motion.div
              key={key}
              id={`kanban-col-${key}`}
              layout
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col w-96 shrink-0 h-full max-h-full pb-2"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-1 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <col.icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/70">
                    {col.title}
                  </h3>
                </div>
                <span className="font-mono text-[9px] text-muted-foreground/40 font-bold">
                  {col.blocks.length}
                </span>
              </div>

              {/* Column Content */}
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 pb-4">
                {col.blocks.map(block => {
                  const collapsed = collapsedIds.has(block.id)
                  return (
                    <div
                      key={block.id}
                      className={`shrink-0 transition-[height,opacity,filter] duration-300 ${collapsed ? 'h-[38px]' : ''} ${activeConnectionId && !relatedIds.has(block.id) ? 'opacity-15 saturate-0' : 'opacity-100'}`}
                    >
                      <TileCard
                        block={block}
                        isCollapsed={collapsed}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onEditAnnotation={onEditAnnotation}
                        onReEnrich={onReEnrich}
                        onChangeType={onChangeType}
                        onToggleCollapse={onToggleCollapse}
                        onToggleSubTask={onToggleSubTask}
                        onDeleteSubTask={onDeleteSubTask}
                        onConnectionHover={handleConnectionHover}
                        onConnectionLock={handleConnectionLock}
                        isConnectionLocked={lockedConnectionId === block.id}
                        allBlocks={blocks}
                        workspaces={workspaces}
                        activeWorkspaceId={activeWorkspaceId}
                        onMoveToWorkspace={onMoveToWorkspace}
                        onCopyToWorkspace={onCopyToWorkspace}
                      />
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
      </div>

      {/* Empty state — absolutely positioned so it centers identically across all views */}
      {blocks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-8 w-[420px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-foreground/35">type-grouped board view</p>

            <div className="flex flex-col gap-5 w-full">
              {([
                { color: "var(--type-task)",     label: "task",     hint: "Review papers on distributed consensus" },
                { color: "var(--type-claim)",    label: "claim",    hint: "Caffeine improves short-term recall by ~15%" },
                { color: "var(--type-question)", label: "question", hint: "Does creativity require periods of solitude?" },
                { color: "var(--type-idea)",     label: "idea",     hint: "What if collaboration refines, not generates, original thought?" },
              ] as const).map(({ color, label, hint }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5" style={{ background: color }} />
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color }}>{label}</span>
                    <p className="text-[14px] leading-snug text-foreground/50">{hint}</p>
                  </div>
                </div>
              ))}
            </div>


            <p className="text-[13px] text-white uppercase tracking-[0.15em] whitespace-nowrap">
              {`type anything · #type to classify · ${mod}K for commands`}
            </p>
          </div>
        </div>
      )}

      {/* Minimap Overlay (Fixed Positioning within relative container) */}
      <div className="absolute bottom-6 right-8 z-30">
        <KanbanMinimap 
          columns={minimapColumns}
          onColumnClick={scrollToColumn}
        />
      </div>
    </div>
  )
}
