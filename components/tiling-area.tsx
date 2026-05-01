"use client"

import React, { useMemo, useRef, useEffect, useState, useCallback } from "react"
import { TileCard, type TextBlock } from "@/components/tile-card"
import { CONTENT_TYPE_CONFIG, type ContentType } from "@/lib/content-types"
import { getRelatedIds, useModKey } from "@/lib/utils"
import { TilingMinimap } from "./tiling-minimap"

/** Number of tiles per BSP page */
const PAGE_SIZE = 7

// Pure BSP helpers — defined outside the component so they are never recreated
function getWeight(n: BSPNode): number {
  if (n.type === 'leaf') return 1
  return getWeight(n.left!) + getWeight(n.right!)
}

function buildPageTree(pageBlocks: TextBlock[], depth: number = 0): BSPNode {
  if (pageBlocks.length === 1) {
    return { id: pageBlocks[0].id, type: 'leaf', blockId: pageBlocks[0].id }
  }
  const mid = Math.floor(pageBlocks.length / 2)
  return {
    id: `split-${depth}-${pageBlocks[0].id}`,
    type: 'split',
    direction: depth % 2 === 0 ? 'v' : 'h',
    left: buildPageTree(pageBlocks.slice(0, mid), depth + 1),
    right: buildPageTree(pageBlocks.slice(mid), depth + 1)
  }
}

interface BSPNode {
  id: string
  type: 'split' | 'leaf'
  direction?: 'h' | 'v'
  left?: BSPNode
  right?: BSPNode
  blockId?: string
}

interface TilingAreaProps {
  blocks: TextBlock[]
  collapsedIds: Set<string>
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onEditAnnotation: (id: string, newAnnotation: string) => void
  onReEnrich: (id: string, newCategory?: string) => void
  onChangeType: (id: string, newType: import("@/lib/content-types").ContentType) => void
  onToggleCollapse: (id: string) => void
  onTogglePin: (id: string) => void
  onToggleSubTask: (id: string, subTaskId: string) => void
  onDeleteSubTask: (id: string, subTaskId: string) => void
  highlightedBlockId?: string | null
  onHighlight: (id: string | null) => void
  workspaces?: { id: string; name: string }[]
  activeWorkspaceId?: string
  onMoveToWorkspace?: (blockId: string, targetWorkspaceId: string) => void
  onCopyToWorkspace?: (blockId: string, targetWorkspaceId: string) => void
}

export function TilingArea({
  blocks,
  collapsedIds,
  onDelete,
  onEdit,
  onEditAnnotation,
  onReEnrich,
  onChangeType,
  onToggleCollapse,
  onTogglePin,
  onToggleSubTask,
  onDeleteSubTask,
  highlightedBlockId,
  onHighlight,
  workspaces,
  activeWorkspaceId,
  onMoveToWorkspace,
  onCopyToWorkspace,
}: TilingAreaProps) {
  const mod = useModKey()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [activePageIdx, setActivePageIdx] = useState(0)
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

  // Clear lock when locked block's connections change (enrichment can change influencedBy)
  useEffect(() => {
    if (!lockedConnectionId) return
    const lockedBlock = blocks.find(b => b.id === lockedConnectionId)
    if (!lockedBlock || !lockedBlock.influencedBy?.length) {
      setLockedConnectionId(null)
    }
  }, [blocks, lockedConnectionId])

  // Escape key clears lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLockedConnectionId(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // 1. Chunking into elastic chunks — declared before effects that depend on them
  const chunkedPages = useMemo(() => {
    const gridBlocks = blocks
      .filter((b: TextBlock) => b.contentType !== "task")
      .sort((a, b) => {
        const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
        if (pinDiff !== 0) return pinDiff
        return a.timestamp - b.timestamp // stable: older blocks first within same pin state
      })
    if (gridBlocks.length === 0) return []
    const chunks: TextBlock[][] = []
    for (let i = 0; i < gridBlocks.length; i += PAGE_SIZE) {
      chunks.push(gridBlocks.slice(i, i + PAGE_SIZE))
    }
    return chunks
  }, [blocks])

  const pageTrees = useMemo(() => {
    return chunkedPages.map(page => buildPageTree(page))
  }, [chunkedPages])

  const taskBlock = useMemo(() => blocks.find((b: TextBlock) => b.contentType === "task"), [blocks])

  // Track which page is in view via IntersectionObserver
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) {
          const idx = Number((visible.target as HTMLElement).dataset.pageIdx)
          if (!isNaN(idx)) setActivePageIdx(idx)
        }
      },
      { root: container, threshold: 0.3 }
    )
    container.querySelectorAll("[data-page-idx]").forEach(p => observer.observe(p))
    return () => observer.disconnect()
  }, [pageTrees.length])

  const scrollToPage = useCallback((idx: number) => {
    const container = scrollContainerRef.current
    if (!container) return
    container.querySelector<HTMLElement>(`[data-page-idx="${idx}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  // Show minimap as soon as content overflows the visible area, regardless of page count
  const [isScrollable, setIsScrollable] = useState(false)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const check = () => setIsScrollable(container.scrollHeight > container.clientHeight)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // 2. Tile Renderer with Width Invariant
  // NOTE: implemented as a plain recursive function (not a React component) so that
  // hoveredConnectionId state changes don't cause React to unmount/remount the tile
  // tree (which would fire mouseleave and immediately clear the hover state).
  const renderBSPNode = (node: BSPNode, pageBlocks: TextBlock[], parentDir?: 'h' | 'v'): React.ReactNode => {
    if (!node) return null

    if (node.type === 'leaf') {
      const block = pageBlocks.find((b: TextBlock) => b.id === node.blockId)
      if (!block) return null
      const isDimmed = activeConnectionId !== null && !relatedIds.has(block.id)
      return (
        <div
          key={block.id}
          id={`tile-${block.id}`}
          className="flex flex-1 p-0.5 overflow-hidden"
        >
          <div className={`flex flex-1 min-w-0 transition-[opacity,filter] duration-300 ${isDimmed ? 'opacity-15 saturate-0' : 'opacity-100'}`}>
            <TileCard
              block={block}
              isCollapsed={false}
              hideCollapse={true}
              onDelete={onDelete}
              onEdit={onEdit}
              onEditAnnotation={onEditAnnotation}
              onReEnrich={onReEnrich}
              onChangeType={onChangeType}
              onToggleCollapse={onToggleCollapse}
              onTogglePin={onTogglePin}
              onToggleSubTask={onToggleSubTask}
              onDeleteSubTask={onDeleteSubTask}
              isHighlighted={highlightedBlockId === block.id}
              onHighlight={onHighlight}
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
        </div>
      )
    }

    const leftWeight = getWeight(node.left!)
    const rightWeight = getWeight(node.right!)

    return (
      <div
        key={node.id}
        className={`flex flex-1 min-h-0 min-w-0 ${node.direction === 'v' ? 'flex-row' : 'flex-col'}`}
      >
        <div style={{ flex: leftWeight }} className="flex min-h-0 min-w-0">
          {renderBSPNode(node.left!, pageBlocks, node.direction)}
        </div>
        <div style={{ flex: rightWeight }} className="flex min-h-0 min-w-0">
          {renderBSPNode(node.right!, pageBlocks, node.direction)}
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#020202]">
      {/* Task Header stays sticky at top */}
      {taskBlock && (
        <div className={`w-full shrink-0 p-1 z-10 transition-[opacity,filter] duration-300 ${activeConnectionId && !relatedIds.has(taskBlock.id) ? 'opacity-15 saturate-0' : 'opacity-100'}`}>
            <TileCard
              block={taskBlock}
              isCollapsed={collapsedIds.has(taskBlock.id)}
              onDelete={onDelete}
              onEdit={onEdit}
              onEditAnnotation={onEditAnnotation}
              onReEnrich={onReEnrich}
              onChangeType={onChangeType}
              onToggleCollapse={onToggleCollapse}
              onTogglePin={onTogglePin}
              onToggleSubTask={onToggleSubTask}
              onDeleteSubTask={onDeleteSubTask}
              isHighlighted={highlightedBlockId === taskBlock.id}
              onHighlight={onHighlight}
              onConnectionHover={handleConnectionHover}
              onConnectionLock={handleConnectionLock}
              isConnectionLocked={lockedConnectionId === taskBlock.id}
              allBlocks={blocks}
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              onMoveToWorkspace={onMoveToWorkspace}
              onCopyToWorkspace={onCopyToWorkspace}
            />
        </div>
      )}

      {/* Paged Mosaic with Vertical Scroll */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-0.5 relative"
        onClick={e => {
          // Clear connection lock when clicking the canvas background (not a tile)
          if (e.target === e.currentTarget) setLockedConnectionId(null)
        }}
      >
        {pageTrees.length > 0 && (
          <div className="flex flex-col w-full">
            {pageTrees.map((tree, idx) => {
              const count = chunkedPages[idx].length
              // Elastic height: if only 1 tile, don't take a whole screen
              const heightClass = count <= 2 ? 'h-[300px]' : count <= 4 ? 'h-[60vh]' : 'h-screen'
              return (
                <div
                  key={idx}
                  data-page-idx={idx}
                  className={`flex w-full ${heightClass} border-b border-white/5 last:border-0`}
                >
                  {renderBSPNode(tree, chunkedPages[idx])}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Empty state — absolutely positioned so it centers identically across all views */}
      {pageTrees.length === 0 && !taskBlock && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-8 w-[420px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-foreground/35">spatial research workspace</p>

            <div className="flex flex-col gap-5 w-full">
              {([
                { color: "var(--type-question)", label: "question", text: "Does consciousness require a period of genuine solitude?" },
                { color: "var(--type-claim)",    label: "claim",    text: "Caffeine improves short-term recall by ~15%" },
                { color: "var(--type-quote)",    label: "quote",    text: "Attention is the rarest form of generosity — Simone Weil" },
                { color: "var(--type-task)",     label: "task",     text: "Review papers on distributed consensus" },
              ] as const).map(({ color, label, text }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5" style={{ background: color }} />
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color }}>{label}</span>
                    <p className="text-[14px] leading-snug text-foreground/50">{text}</p>
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

      {/* Floating minimap — shown as soon as content overflows the visible area */}
      {isScrollable && chunkedPages.length >= 1 && (
        <div className="absolute right-4 bottom-4 pointer-events-none z-20">
          <div className="pointer-events-auto">
            <TilingMinimap
              pages={chunkedPages}
              activePageIdx={activePageIdx}
              onPageClick={scrollToPage}
            />
          </div>
        </div>
      )}
    </div>
  )
}
