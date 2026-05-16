import type { GhostNote } from "@/components/ghost-panel"
import type { TextBlock } from "@/components/tile-card"

export interface Project {
  id: string
  name: string
  blocks: TextBlock[]
  collapsedIds: string[]
  ghostNotes: GhostNote[]
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
  /** Texts of recently generated ghost notes — passed back to the API to prevent near-duplicates */
  lastGhostTexts?: string[]
}
