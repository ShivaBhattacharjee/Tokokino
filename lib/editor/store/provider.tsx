"use client"

import * as React from "react"
import { toast } from "sonner"

import { copyCanvasAsPng } from "../export"
import type { CanvasState } from "../state-types"
import { useEditorStore } from "../store"
import { TEMPLATES } from "../templates"
import {
  applyTemplate,
  templateApplyErrorMessage,
  templateApplyReplacedState,
} from "../templates/apply"
import {
  ANIMATION_UNSUPPORTED_MESSAGE,
  isAnimationUnsupportedViewport,
} from "../templates/catalog"

import {
  applyEditorDraft,
  createEditorDraftSnapshot,
  EDITOR_DRAFT_SAVE_DELAY_MS,
  isBrowserIndexedDbAvailable,
  readEditorDraft,
  writeEditorDraft,
} from "./draft-persistence"

/**
 * Autosave runs on every store change, so a broken IndexedDB (quota, private
 * mode, corrupt object store) would fire endlessly. Report the first failure of
 * a run and stay quiet until a save succeeds again — silence is what makes this
 * one dangerous: the user keeps editing, closes the tab, and the work is gone.
 */
let autosaveFailureReported = false

function reportAutosaveFailure(error: unknown) {
  console.error("Unable to save editor draft", error)
  if (autosaveFailureReported) return
  autosaveFailureReported = true
  toast.error("Couldn't save your work in this browser", {
    description: "Save the project to your account to keep it.",
    duration: 10000,
  })
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  )
}

/**
 * Resolve `/app?template=<id>` to a known template. The landing showcase links
 * here so a picked template opens straight in the editor.
 */
function pendingTemplateFromUrl() {
  if (typeof window === "undefined") return null
  const id = new URLSearchParams(window.location.search).get("template")
  if (!id) return null
  return TEMPLATES.find((t) => t.id === id) ?? null
}

function stripTemplateParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete("template")
  window.history.replaceState(null, "", url.pathname + url.search + url.hash)
}

/**
 * Apply a URL template as a fresh unsaved project and strip the query param so
 * a refresh doesn't re-apply it over the user's subsequent edits. Returns
 * whether the store now holds template state — a failed apply that already
 * replaced it still counts, so the stored draft isn't restored on top.
 */
function applyPendingTemplate(): boolean {
  const template = pendingTemplateFromUrl()
  if (!template) return false
  if (template.category === "animation" && isAnimationUnsupportedViewport()) {
    stripTemplateParam()
    toast.info(ANIMATION_UNSUPPORTED_MESSAGE)
    return false
  }
  try {
    applyTemplate(template)
  } catch (error) {
    console.error("Unable to apply template from URL", error)
    // Strip either way: the same link would fail the same way on reload, and
    // leaving it in place implies a template the editor isn't actually showing.
    stripTemplateParam()
    toast.error(templateApplyErrorMessage(error))
    return templateApplyReplacedState(error)
  }
  stripTemplateParam()
  toast.success(`Applied "${template.name}"`)
  return true
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const isCopyingCanvasRef = React.useRef(false)
  // Dedupe the URL-template apply across StrictMode's dev double-invoke (same
  // instance, so refs persist) while still re-evaluating on a genuine remount.
  const templateGuardRef = React.useRef(false)
  const templateAppliedRef = React.useRef(false)

  React.useEffect(() => {
    // A URL template starts a fresh unsaved project — apply it before anything
    // reads persistence so it wins over a restored draft, and works even where
    // IndexedDB is unavailable.
    if (!templateGuardRef.current) {
      templateGuardRef.current = true
      templateAppliedRef.current = applyPendingTemplate()
    }
    const templateApplied = templateAppliedRef.current

    if (!isBrowserIndexedDbAvailable()) return

    let saveTimer: number | null = null
    let unsubscribe: (() => void) | null = null
    let cancelled = false

    const saveNow = () => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer)
        saveTimer = null
      }
      void writeEditorDraft(
        createEditorDraftSnapshot(useEditorStore.getState())
      )
        .then(() => {
          autosaveFailureReported = false
        })
        .catch(reportAutosaveFailure)
    }

    const scheduleSave = () => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer)
      }
      saveTimer = window.setTimeout(saveNow, EDITOR_DRAFT_SAVE_DELAY_MS)
    }

    const startAutosave = () => {
      if (cancelled) return
      unsubscribe = useEditorStore.subscribe(scheduleSave)
      window.addEventListener("pagehide", saveNow)
    }

    void readEditorDraft()
      .then((draft) => {
        if (cancelled) return
        // Don't let a stored draft overwrite a template picked from the URL;
        // autosave will persist the template as the new draft instead.
        if (!templateApplied && draft) {
          useEditorStore.setState(applyEditorDraft(draft))
        }
        startAutosave()
      })
      .catch((error) => {
        console.error("Unable to restore editor draft", error)
        // An unreadable draft opens what looks like a brand-new project. Left
        // unsaid, the user assumes their last session was never saved.
        toast.error("Couldn't restore your last project from this browser")
        startAutosave()
      })

    return () => {
      cancelled = true
      unsubscribe?.()
      window.removeEventListener("pagehide", saveNow)
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer)
      }
    }
  }, [])

  React.useEffect(() => {
    const onDeleteKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return
      if (isEditableKeyboardTarget(e.target)) return

      const store = useEditorStore.getState()
      const {
        selectedTextId,
        selectedAssetId,
        selectedAnnotationShapeId,
        selectedScreenshotSlotId,
        isScreenshotSelected,
      } = store

      const findCanvasId = (predicate: (canvas: CanvasState) => boolean) =>
        store.present.canvases.find(predicate)?.id ??
        store.present.activeCanvasId

      if (selectedTextId) {
        e.preventDefault()
        e.stopImmediatePropagation()
        store.deleteText(
          selectedTextId,
          findCanvasId((canvas) =>
            canvas.texts.some((text) => text.id === selectedTextId)
          )
        )
        store.setSelectedTextId(null)
        return
      }

      if (selectedAssetId) {
        e.preventDefault()
        e.stopImmediatePropagation()
        store.deleteAsset(
          selectedAssetId,
          findCanvasId((canvas) =>
            canvas.assets.some((asset) => asset.id === selectedAssetId)
          )
        )
        store.setSelectedAssetId(null)
        return
      }

      if (selectedAnnotationShapeId) {
        e.preventDefault()
        e.stopImmediatePropagation()
        store.deleteAnnotationShape(
          selectedAnnotationShapeId,
          findCanvasId((canvas) =>
            canvas.annotationShapes.some(
              (shape) => shape.id === selectedAnnotationShapeId
            )
          )
        )
        store.setSelectedAnnotationShapeId(null)
        return
      }

      if (
        selectedScreenshotSlotId &&
        store.presetTab !== "multi" &&
        store.presetTab !== "triple" &&
        !(store.presetTab === "custom" && store.activeCustomPresetId)
      ) {
        e.preventDefault()
        e.stopImmediatePropagation()
        store.deleteScreenshotSlot(
          selectedScreenshotSlotId,
          findCanvasId((canvas) =>
            canvas.screenshotSlots.some(
              (slot) => slot.id === selectedScreenshotSlotId
            )
          )
        )
        store.setSelectedScreenshotSlotId(null)
        return
      }

      if (isScreenshotSelected) {
        e.preventDefault()
        e.stopImmediatePropagation()
        store.setScreenshot(null)
        store.setIsScreenshotSelected(false)
      }
    }

    window.addEventListener("keydown", onDeleteKey, true)
    return () => window.removeEventListener("keydown", onDeleteKey, true)
  }, [])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableKeyboardTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key === "z" || e.key === "Z") {
        e.preventDefault()
        if (e.shiftKey) useEditorStore.getState().redo()
        else useEditorStore.getState().undo()
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault()
        useEditorStore.getState().redo()
      } else if ((e.key === "c" || e.key === "C") && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        if (isCopyingCanvasRef.current) return

        const canvasId = useEditorStore.getState().present.activeCanvasId
        if (!canvasId) return

        isCopyingCanvasRef.current = true
        const toastId = toast.loading("Copying to clipboard…")
        void copyCanvasAsPng(canvasId, "1080p", { watermark: true })
          .then(() => toast.success("Copied to clipboard", { id: toastId }))
          .catch((error) => {
            console.error(error)
            toast.error("Copy failed. Please try again.", { id: toastId })
          })
          .finally(() => {
            isCopyingCanvasRef.current = false
          })
      }
    }
    // Listen in capture phase so transient timeline controls, menus and drag
    // surfaces cannot swallow Cmd/Ctrl+Z before editor history receives it.
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [])

  return <>{children}</>
}

export async function saveCurrentEditorDraft() {
  if (!isBrowserIndexedDbAvailable()) return
  await writeEditorDraft(createEditorDraftSnapshot(useEditorStore.getState()))
}

/**
 * Stash the project before an auth flow navigates the tab away. Sign-in is the
 * one moment the user is promised their work will still be here afterwards, so
 * a failed stash has to be said out loud — they can still copy or export first.
 */
export async function saveEditorDraftBeforeAuth() {
  try {
    await saveCurrentEditorDraft()
  } catch (error) {
    console.error("Could not save local editor state before auth", error)
    toast.error("Couldn't save your work before signing in", {
      description: "Export or copy the canvas first if you need to keep it.",
      duration: 10000,
    })
  }
}
