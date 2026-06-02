"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

interface IntroModalProps {
  open: boolean
  onClose: () => void
}

export function IntroModal({ open, onClose }: IntroModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-3xl bg-card border border-border rounded-sm shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-0.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/60" />
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/30" />
                  </div>
                  <span className="font-mono text-sm font-black text-foreground tracking-tight">nodepad</span>
                </div>
                <p className="text-xs text-muted-foreground/60 font-mono uppercase tracking-widest">
                  A quick introduction
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Video embed — 16:9 */}
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src="https://www.youtube-nocookie.com/embed/nCLY7rHAjWE?autoplay=1&rel=0&modestbranding=1&color=white"
                title="nodepad introduction"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-xs text-muted-foreground/40">
                You can replay this anytime via the <span className="font-mono font-black text-muted-foreground/60">?</span> button
              </p>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-mono font-medium rounded-sm bg-muted/20 hover:bg-muted/40 text-foreground/70 hover:text-foreground border border-border hover:border-muted-foreground/20 transition-all"
              >
                Skip to app →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
