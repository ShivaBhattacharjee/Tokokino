"use client"

import * as React from "react"
import { toast } from "sonner"

import { copyCanvasAsPng } from "../export"
import type { CanvasState } from "../state-types"
import { useEditorStore } from "../store"

import {
  applyEditorDraft,
  createEditorDraftSnapshot,
  EDITOR_DRAFT_SAVE_DELAY_MS,
  isBrowserIndexedDbAvailable,
  readEditorDraft,
  writeEditorDraft,
} from "./draft-persistence"

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  )
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const isCopyingCanvasRef = React.useRef(false)

  React.useEffect(() => {
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
      ).catch((error) => {
        console.warn("Unable to save editor draft", error)
      })
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
        if (draft) {
          useEditorStore.setState(applyEditorDraft(draft))
        }
        startAutosave()
      })
      .catch((error) => {
        console.warn("Unable to restore editor draft", error)
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
