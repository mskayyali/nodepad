"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import {
  Plus,
  Settings,
  Trash2,
  Check,
  X,
  Edit3,
  LayoutGrid,
  ArrowLeft,
  Key,
  ChevronDown,
  Globe,
  Eye,
  EyeOff,
  Save,
  FolderInput,
  Search,
  Sun,
  Moon,
} from "lucide-react"
import {
  AI_PROVIDER_PRESETS,
  getModelsForProvider,
  getPreset,
  fetchModelsFromProvider,
  type AISettings,
  type AIModel,
  type AIProvider,
  type FetchedModel,
} from "@/lib/ai-settings"

interface Project {
  id: string
  name: string
  blocks: any[]
  collapsedIds: string[]
}

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  activeProjectId: string
  onSelectProject: (id: string) => void
  onCreateProject: () => void
  onImportProject: () => void
  onRenameProject: (id: string, newName: string) => void
  onDeleteProject: (id: string) => void
  openToSettings?: boolean
  onSettingsOpened?: () => void
  // AI Settings
  aiSettings: AISettings
  onUpdateAISettings: (patch: Partial<AISettings>) => void
}

export function ProjectSidebar({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onImportProject,
  onRenameProject,
  onDeleteProject,
  aiSettings,
  onUpdateAISettings,
  openToSettings,
  onSettingsOpened,
}: ProjectSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [modelSearch, setModelSearch] = useState("")
  // local draft for settings (only save on "Save")
  const [draft, setDraft] = useState<AISettings>(aiSettings)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  // Sync draft when panel opens
  useEffect(() => {
    if (showSettings) setDraft(aiSettings)
  }, [showSettings])

  // Jump straight to settings when requested externally
  useEffect(() => {
    if (openToSettings) {
      setShowSettings(true)
      onSettingsOpened?.()
    }
  }, [openToSettings])

  // Auto-fetch models when provider + key are available (debounced)
  useEffect(() => {
    if (!showSettings || !draft.apiKey.trim()) {
      setFetchedModels([])
      setFetchingModels(false)
      setFetchError(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      setFetchingModels(true)
      setFetchError(null)
      fetchModelsFromProvider(draft.provider, draft.apiKey.trim(), draft.customBaseUrl)
        .then(models => {
          if (!cancelled) {
            setFetchedModels(models.sort((a, b) => a.id.localeCompare(b.id)))
            setFetchingModels(false)
          }
        })
        .catch(err => {
          if (!cancelled) {
            setFetchedModels([])
            setFetchError(err instanceof Error ? err.message : "Failed to fetch models")
            setFetchingModels(false)
          }
        })
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [showSettings, draft.provider, draft.apiKey, draft.customBaseUrl])

  const handleRename = (id: string) => {
    if (editName.trim()) onRenameProject(id, editName.trim())
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    onDeleteProject(id)
    setDeletingId(null)
  }

  const persistSettings = () => {
    // Trim key to strip accidental whitespace/newlines from paste
    const trimmedKey = draft.apiKey.trim()
    const providerKeys: Partial<Record<AIProvider, string>> = {
      ...(draft.providerKeys ?? {}),
      [draft.provider]: trimmedKey,
    }
    onUpdateAISettings({ ...draft, apiKey: trimmedKey, providerKeys })
  }

  const handleSaveSettings = () => {
    persistSettings()
    setShowSettings(false)
  }

  // Auto-save settings when the sidebar closes or when navigating back,
  // so key edits are never silently dropped.
  const handleClose = () => {
    if (showSettings) persistSettings()
    onClose()
  }

  const currentPreset = getPreset(draft.provider)
  const models = getModelsForProvider(draft.provider)

  /** Convert a fetched model into the standard AIModel shape. */
  const toAIModel = (fm: FetchedModel | undefined): AIModel | undefined =>
    fm
      ? {
          id: fm.id,
          label: fm.name || fm.id.split("/").pop() || fm.id,
          shortLabel: fm.name || fm.id.split("/").pop() || fm.id,
          description: fm.description || "Custom model",
          supportsGrounding: false,
        }
      : undefined

  /** Build a minimal AIModel for a raw model ID string. */
  const customModel = (id: string): AIModel => ({
    id,
    label: id,
    shortLabel: id.split("/").pop() || id,
    description: "Custom model",
    supportsGrounding: false,
  })

  const selectedModel =
    models.find(m => m.id === draft.modelId) ??
    toAIModel(fetchedModels.find(m => m.id === draft.modelId)) ??
    (draft.modelId ? customModel(draft.modelId) : undefined) ??
    models[0]

  return (
    <div
      style={{
        width: isOpen ? (showSettings ? 320 : 240) : 0,
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? "visible" : "hidden"
      }}
      className="relative z-50 transition-all duration-200 ease-in-out overflow-hidden border-r border-border bg-muted/20 backdrop-blur-3xl flex flex-col h-full"
    >
      <div style={{ width: showSettings ? 320 : 240 }} className="flex flex-col h-full">
        {/* Header */}
        <div className="flex h-10 items-center justify-between border-b border-border bg-card/5 backdrop-blur-md px-3 py-1.5 shrink-0">
          <div className="flex items-center gap-2.5">
            {showSettings ? (
              <button
                onClick={handleSaveSettings}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="font-mono text-xs font-bold uppercase tracking-tight">Settings</span>
              </button>
            ) : (
              <>
                <div className="flex items-center justify-center h-5 w-5 bg-primary/10 rounded-sm">
                  <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="font-mono text-xs font-bold uppercase tracking-tight text-foreground/80 select-none">
                  Spaces
                </h2>
              </>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 px-1.5 hover:bg-muted/50 rounded-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content — animated slide between projects/settings */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait" initial={false}>
            {!showSettings ? (
              <motion.div
                key="projects"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar"
              >
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`group relative rounded-sm transition-all duration-150 ${
                      activeProjectId === project.id
                        ? "bg-primary/10 shadow-[inset_0_1px_0px_rgba(255,255,255,0.05)]"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center p-2 px-2.5">
                      <button
                        onClick={() => onSelectProject(project.id)}
                        className="flex-1 text-left flex flex-col gap-0 overflow-hidden"
                      >
                        {editingId === project.id ? (
                          <input
                            ref={inputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(project.id)
                              if (e.key === "Escape") setEditingId(null)
                            }}
                            onBlur={() => handleRename(project.id)}
                            className="bg-transparent font-mono text-xs font-bold text-foreground focus:outline-none w-full border-b border-primary/50 py-0"
                          />
                        ) : (
                          <span className={`font-mono text-[12px] font-bold truncate ${
                            activeProjectId === project.id ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                          }`}>
                            {project.name}
                          </span>
                        )}
                        <span className="font-mono text-[8px] text-muted-foreground uppercase tracking-tighter font-bold">
                          {project.blocks.length} {project.blocks.length === 1 ? 'node' : 'nodes'}
                        </span>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingId !== project.id && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditName(project.name)
                                setEditingId(project.id)
                              }}
                              className="p-1 hover:bg-muted/50 rounded-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            {projects.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeletingId(project.id)
                                }}
                                className="p-1 hover:bg-destructive/20 rounded-sm text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Delete Confirmation Overlay */}
                    <AnimatePresence>
                      {deletingId === project.id && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0 }}
                          className="absolute inset-0 z-10 bg-destructive/95 backdrop-blur-md rounded-sm flex items-center justify-between px-3"
                        >
                          <span className="font-mono text-[8px] font-bold text-white uppercase tracking-tighter">
                            Delete Space?
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(project.id)}
                              className="p-1 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="p-1 bg-black/30 hover:bg-black/40 rounded-full text-white transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto px-3 py-4 flex flex-col gap-5 custom-scrollbar"
              >
                {/* Provider Selector */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Provider
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setProviderOpen(v => !v)}
                      className="flex w-full items-center justify-between rounded-md border border-border bg-muted/20 px-2.5 py-2 text-left hover:bg-muted/30 focus:outline-none transition-colors"
                    >
                      <span className="font-mono text-[11px] font-bold text-foreground">{currentPreset.label}</span>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${providerOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {providerOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-xl"
                        >
                          {AI_PROVIDER_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                const newModels = getModelsForProvider(preset.id)
                                setDraft(d => ({
                                  ...d,
                                  provider: preset.id,
                                  modelId: newModels[0]?.id ?? d.modelId,
                                  webGrounding: d.webGrounding,
                                  customBaseUrl: "",
                                  // Restore the saved key for this provider if one exists,
                                  // otherwise clear so the user knows to enter a new one.
                                  apiKey: d.providerKeys?.[preset.id] ?? "",
                                }))
                                setProviderOpen(false)
                              }}
                              className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-muted/50 transition-colors"
                            >
                              <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                draft.provider === preset.id ? "border-primary bg-primary/20" : "border-border"
                              }`}>
                                {draft.provider === preset.id && <Check className="h-2.5 w-2.5 text-primary" />}
                              </div>
                              <span className="font-mono text-[10px] font-bold text-foreground">{preset.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* API Key */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    API Key
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                    <Key className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <input
                      type="text"
                      value={draft.apiKey}
                      onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
                      placeholder={currentPreset.keyPlaceholder || "Your API key"}
                      className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                      style={showKey ? undefined : { WebkitTextSecurity: "disc" } as never}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button onClick={() => setShowKey(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    Stored locally. Never sent to a server.{" "}
                    {currentPreset.keyUrl && (
                      <a href={currentPreset.keyUrl} target="_blank" rel="noopener noreferrer"
                        className="text-primary underline hover:brightness-125 transition-all">
                        Get a key →
                      </a>
                    )}
                  </p>
                </div>

                {/* Custom Base URL */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Custom Base URL
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                    <input
                      type="text"
                      value={draft.customBaseUrl ?? ""}
                      onChange={e => setDraft(d => ({ ...d, customBaseUrl: e.target.value }))}
                      placeholder="Optional — for local/self-hosted endpoints"
                      className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    Override the provider URL. Useful for Ollama, LM Studio, vLLM, or other OpenAI-compatible endpoints.
                  </p>
                </div>

                {/* Model Selector */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Model
                  </label>
                  {models.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                      <input
                        type="text"
                        value={draft.modelId}
                        onChange={e => setDraft(d => ({ ...d, modelId: e.target.value }))}
                        placeholder="e.g. gpt-4o, claude-3-opus-20240229"
                        className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => { setModelOpen(v => { if (v) setModelSearch(""); return !v }) }}
                        className="flex w-full items-center justify-between rounded-md border border-border bg-muted/20 px-2.5 py-2 text-left hover:bg-muted/30 focus:outline-none transition-colors"
                      >
                        <div>
                          <div className="font-mono text-[11px] font-bold text-foreground">{selectedModel?.label ?? draft.modelId}</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5">{selectedModel?.description ?? "Custom model ID"}</div>
                        </div>
                        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${modelOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {modelOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                            className="mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-xl"
                          >
                            {/* Search input */}
                            <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border">
                              <Search className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                              <input
                                type="text"
                                value={modelSearch}
                                onChange={e => setModelSearch(e.target.value)}
                                placeholder="Search models…"
                                className="flex-1 bg-transparent font-sans text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
                                autoFocus
                                spellCheck={false}
                              />
                            </div>
                            <div className="max-h-[280px] overflow-y-auto custom-scrollbar">
                              {/* Preset / recommended models */}
                              {models
                                .filter(model => !modelSearch || model.label.toLowerCase().includes(modelSearch.toLowerCase()) || model.id.toLowerCase().includes(modelSearch.toLowerCase()))
                                .map(model => (
                                  <button
                                    key={model.id}
                                    onClick={() => {
                                      setDraft(d => ({ ...d, modelId: model.id, webGrounding: model.supportsGrounding ? d.webGrounding : false }))
                                      setModelOpen(false)
                                      setModelSearch("")
                                    }}
                                    className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-muted/50 transition-colors"
                                  >
                                    <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                      draft.modelId === model.id ? "border-primary bg-primary/20" : "border-border"
                                    }`}>
                                      {draft.modelId === model.id && <Check className="h-2.5 w-2.5 text-primary" />}
                                    </div>
                                    <div>
                                      <div className="font-mono text-[10px] font-bold text-foreground">{model.label}</div>
                                      <div className="font-mono text-[9px] text-muted-foreground">{model.description}</div>
                                    </div>
                                    {model.supportsGrounding && (draft.provider === "openrouter" || draft.provider === "openai") && <Globe className="ml-auto h-3 w-3 shrink-0 text-primary/50" />}
                                  </button>
                                ))}

                              {/* Fetched models from provider API */}
                              {fetchedModels.length > 0 && (
                                <>
                                  <div className="px-2.5 py-1.5 border-t border-border">
                                    <span className="font-sans text-[8px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                                      All available models ({fetchedModels.length})
                                    </span>
                                  </div>
                                  {fetchedModels
                                    .filter(fm => !models.some(m => m.id === fm.id))
                                    .filter(fm => {
                                      if (!modelSearch) return true
                                      const q = modelSearch.toLowerCase()
                                      return fm.id.toLowerCase().includes(q) ||
                                        (fm.name && fm.name.toLowerCase().includes(q)) ||
                                        (fm.description && fm.description.toLowerCase().includes(q))
                                    })
                                    .map(fm => {
                                      const displayName = fm.name || fm.id.split("/").pop() || fm.id
                                      const shortDesc = fm.description
                                        ? fm.description.length > 80
                                          ? fm.description.slice(0, 80).trimEnd() + "…"
                                          : fm.description
                                        : null
                                      return (
                                        <button
                                          key={fm.id}
                                          onClick={() => {
                                            setDraft(d => ({ ...d, modelId: fm.id, webGrounding: false }))
                                            setModelOpen(false)
                                            setModelSearch("")
                                          }}
                                          className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-muted/50 transition-colors"
                                        >
                                          <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                            draft.modelId === fm.id ? "border-primary bg-primary/20" : "border-border"
                                          }`}>
                                            {draft.modelId === fm.id && <Check className="h-2.5 w-2.5 text-primary" />}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-sans text-[11px] font-bold text-foreground">{displayName}</span>
                                              {fm.isFree && (
                                                <span className="font-sans text-[7px] font-bold uppercase tracking-wider text-primary bg-primary/15 px-1 py-px rounded">Free</span>
                                              )}
                                            </div>
                                            {shortDesc && (
                                              <div className="font-sans text-[9px] text-muted-foreground leading-snug mt-0.5">{shortDesc}</div>
                                            )}
                                          </div>
                                        </button>
                                      )
                                    })}
                                </>
                              )}

                              {fetchingModels && (
                                <div className="px-2.5 py-2 flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                  <span className="font-sans text-[9px] text-muted-foreground">Loading models…</span>
                                </div>
                              )}
                              {fetchError && !fetchingModels && (
                                <div className="px-2.5 py-2 border-t border-border">
                                  <span className="font-sans text-[9px] text-destructive/70">{fetchError}</span>
                                </div>
                              )}
                              {!fetchingModels && modelSearch && (() => {
                                const q = modelSearch.toLowerCase()
                                const presetHits = models.filter(m => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)).length
                                const fetchedHits = fetchedModels.filter(fm => !models.some(m => m.id === fm.id)).filter(fm => fm.id.toLowerCase().includes(q) || (fm.name && fm.name.toLowerCase().includes(q)) || (fm.description && fm.description.toLowerCase().includes(q))).length
                                return presetHits === 0 && fetchedHits === 0
                              })() && (
                                <div className="px-2.5 py-2">
                                  <span className="font-sans text-[9px] text-muted-foreground/50">No models match &ldquo;{modelSearch}&rdquo;</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Web Grounding (OpenRouter + OpenAI) */}
                {(draft.provider === "openrouter" || draft.provider === "openai") && selectedModel && (
                  <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/10 px-2.5 py-2.5">
                    <div className="flex items-start gap-2">
                      <Globe className="h-3.5 w-3.5 mt-0.5 text-primary/60 shrink-0" />
                      <div>
                        <div className="font-mono text-[11px] font-bold text-foreground">Web Grounding</div>
                        <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-relaxed">
                          {selectedModel.supportsGrounding
                            ? draft.provider === "openai"
                              ? `Uses ${selectedModel.groundingModelId ?? "search-preview"} for live web access`
                              : "Adds :online for live search"
                            : "Not available for this model"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => selectedModel.supportsGrounding && setDraft(d => ({ ...d, webGrounding: !d.webGrounding }))}
                      disabled={!selectedModel.supportsGrounding}
                      className={`relative shrink-0 h-5 w-9 rounded-full transition-all duration-200 ${
                        draft.webGrounding && selectedModel.supportsGrounding ? "bg-primary" : "bg-muted"
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
                        draft.webGrounding && selectedModel.supportsGrounding ? "left-5" : "left-0.5"
                      }`} />
                    </button>
                  </div>
                )}

                {/* API Status */}
                <div className={`flex items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[9px] ${
                  draft.apiKey
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "bg-muted/20 border border-border text-muted-foreground"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${draft.apiKey ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`} />
                  {draft.apiKey ? `${currentPreset.label} — API key configured` : "No API key — AI disabled"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/10 shrink-0">
          {showSettings ? (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleSaveSettings}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
              >
                <span>Save Settings</span>
                <Save className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex items-center justify-center w-full h-8 px-2.5 rounded-sm bg-muted/30 hover:bg-muted/50 text-muted-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-border"
              >
                Cancel
              </button>
              {/* Theme toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-muted/30 hover:bg-muted/50 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-border"
                >
                  <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                  {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={onCreateProject}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
              >
                <span>New Space</span>
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onImportProject}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-border"
                title="Import a .nodepad file"
              >
                <span>Import .nodepad</span>
                <FolderInput className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-border"
              >
                <span>Settings</span>
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
