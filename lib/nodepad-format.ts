/**
 * .nodepad file format — full-fidelity project serialisation.
 *
 * A .nodepad file is a JSON object with a version field so future schema
 * changes can be handled gracefully. The file contains the complete project
 * state: blocks (with all AI annotations, connections, confidence scores,
 * sub-tasks), collapsed IDs, ghost notes history, and enough context for
 * the AI enrichment pipeline to continue seamlessly on re-import.
 *
 * Transient UI fields (isEnriching, isError, statusText) are stripped on
 * export and reset to safe defaults on import.
 */

import type { ContentType } from "./content-types"

export const NODEPAD_FILE_VERSION = 1 as const

// ── Serialised types ──────────────────────────────────────────────────────────

export interface NodepadBlock {
  id: string
  text: string
  timestamp: number
  contentType: ContentType
  category?: string
  annotation?: string
  confidence?: number | null
  sources?: { url: string; title: string; siteName: string }[]
  influencedBy?: string[]        // stable block IDs (not category strings)
  isUnrelated?: boolean
  isPinned?: boolean
  subTasks?: { id: string; text: string; isDone: boolean; timestamp: number }[]
}

export interface NodepadGhostNote {
  id: string
  text: string
  category: string
  isGenerating: boolean
}

export interface NodepadFile {
  version: typeof NODEPAD_FILE_VERSION
  exportedAt: number
  project: {
    id: string
    name: string
    blocks: NodepadBlock[]
    collapsedIds: string[]
    ghostNotes: NodepadGhostNote[]
    lastGhostTexts?: string[]
    lastGhostBlockCount?: number
    lastGhostTimestamp?: number
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

/** Serialise a project to a NodepadFile, stripping transient UI state. */
export function serialiseProject(project: {
  id: string
  name: string
  blocks: any[]
  collapsedIds: string[]
  ghostNotes?: any[]
  lastGhostTexts?: string[]
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
}): NodepadFile {
  return {
    version: NODEPAD_FILE_VERSION,
    exportedAt: Date.now(),
    project: {
      id: project.id,
      name: project.name,
      collapsedIds: project.collapsedIds ?? [],
      ghostNotes: (project.ghostNotes ?? []).map((g: any) => ({
        id: g.id,
        text: g.text,
        category: g.category,
        isGenerating: false,          // never persist a generating state
      })),
      lastGhostTexts: project.lastGhostTexts,
      lastGhostBlockCount: project.lastGhostBlockCount,
      lastGhostTimestamp: project.lastGhostTimestamp,
      blocks: project.blocks.map((b: any): NodepadBlock => ({
        id:           b.id,
        text:         b.text,
        timestamp:    b.timestamp,
        contentType:  b.contentType,
        ...(b.category     !== undefined && { category:    b.category }),
        ...(b.annotation   !== undefined && { annotation:  b.annotation }),
        ...(b.confidence   !== undefined && { confidence:  b.confidence }),
        ...(b.sources      !== undefined && { sources:     b.sources }),
        ...(b.influencedBy !== undefined && { influencedBy: b.influencedBy }),
        ...(b.isUnrelated  !== undefined && { isUnrelated:  b.isUnrelated }),
        ...(b.isPinned                   && { isPinned:     b.isPinned }),
        ...(b.subTasks?.length           && { subTasks:     b.subTasks }),
      })),
    },
  }
}

/** Trigger a browser download of a .nodepad file for the given project. */
export function downloadNodepadFile(project: {
  id: string; name: string; blocks: any[]; collapsedIds: string[]
  ghostNotes?: any[]; lastGhostTexts?: string[]
  lastGhostBlockCount?: number; lastGhostTimestamp?: number
}): void {
  const data = serialiseProject(project)
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  const slug = project.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60)
  a.href     = url
  a.download = `${slug || "project"}.nodepad`
  a.click()
  URL.revokeObjectURL(url)
}

// ── File System Access API (auto-save) ───────────────────────────────────────

type ProjectLike = {
  id: string; name: string; blocks: any[]; collapsedIds: string[]
  ghostNotes?: any[]; lastGhostTexts?: string[]
  lastGhostBlockCount?: number; lastGhostTimestamp?: number
}

/**
 * Open a save-file picker and return a FileSystemFileHandle the app can
 * write to repeatedly without further prompts. Returns null if the user
 * cancels or the API is unavailable.
 */
export async function pickSaveLocation(project: ProjectLike): Promise<FileSystemFileHandle | null> {
  if (typeof window === "undefined" || !("showSaveFilePicker" in window)) return null
  const slug = project.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60)
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: `${slug || "project"}.nodepad`,
      types: [{
        description: "Nodepad project",
        accept: { "application/json": [".nodepad"] },
      }],
    })
    // Write the initial export immediately
    await writeToHandle(handle, project)
    return handle
  } catch {
    return null // user cancelled
  }
}

/** Write the current project state to an existing file handle. */
export async function writeToHandle(
  handle: FileSystemFileHandle,
  project: ProjectLike,
): Promise<boolean> {
  try {
    const data = serialiseProject(project)
    const writable = await (handle as any).createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
    return true
  } catch {
    return false
  }
}

// ── Import ────────────────────────────────────────────────────────────────────

export class NodepadParseError extends Error {}

/**
 * Parse a .nodepad file string and return a project object ready to push
 * into the projects list. Always assigns a fresh ID so there are no
 * collisions. Name conflicts get a copy suffix: "My Research (2)".
 */
export function parseNodepadFile(
  raw: string,
  existingNames: string[],
): {
  id: string
  name: string
  blocks: any[]
  collapsedIds: string[]
  ghostNotes: any[]
  lastGhostTexts?: string[]
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
} {
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    throw new NodepadParseError("Not a valid .nodepad file — JSON parse failed.")
  }

  if (!data || typeof data !== "object") {
    throw new NodepadParseError("Not a valid .nodepad file — unexpected root type.")
  }
  if (!data.project || !Array.isArray(data.project.blocks)) {
    throw new NodepadParseError("Not a valid .nodepad file — missing project.blocks array.")
  }

  const src = data.project

  // Deduplicate name — always "Name (2)", "Name (3)", …
  let name = (src.name as string) || "Imported Project"
  if (existingNames.includes(name)) {
    let n = 2
    while (existingNames.includes(`${name} (${n})`)) n++
    name = `${name} (${n})`
  }

  return {
    id:           Math.random().toString(36).substring(2, 10),
    name,
    blocks:       (src.blocks as any[]).map(b => ({
      ...b,
      isEnriching: false,
      isError:     false,
      statusText:  undefined,
    })),
    collapsedIds: Array.isArray(src.collapsedIds) ? src.collapsedIds : [],
    ghostNotes:   Array.isArray(src.ghostNotes)   ? src.ghostNotes   : [],
    lastGhostTexts:       src.lastGhostTexts,
    lastGhostBlockCount:  src.lastGhostBlockCount,
    lastGhostTimestamp:   src.lastGhostTimestamp,
  }
}
