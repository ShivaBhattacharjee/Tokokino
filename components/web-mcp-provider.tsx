"use client"

import { useEffect } from "react"

type RegisterToolFn = (tool: object, opts: { signal: AbortSignal }) => void

function getModelContext(): { registerTool: RegisterToolFn } | null {
  if ("modelContext" in navigator)
    return navigator.modelContext as { registerTool: RegisterToolFn }
  if ("modelContext" in document)
    return document.modelContext as { registerTool: RegisterToolFn }
  return null
}

export function WebMcpProvider() {
  useEffect(() => {
    const ctx = getModelContext()
    if (!ctx) return

    const controller = new AbortController()
    const signal = controller.signal

    ctx.registerTool(
      {
        name: "navigate-to-editor",
        title: "Open Editor",
        description:
          "Navigate to the Tokokino screenshot editor to start creating or editing a mockup.",
        inputSchema: { type: "object", properties: {}, required: [] },
        annotations: { readOnlyHint: false },
        execute: () => {
          window.location.href = "/app"
          return { status: "navigating to editor" }
        },
      },
      { signal }
    )

    ctx.registerTool(
      {
        name: "get-site-info",
        title: "Site Info",
        description:
          "Return information about what Tokokino is and its key features.",
        inputSchema: { type: "object", properties: {}, required: [] },
        annotations: { readOnlyHint: true },
        execute: () => ({
          name: "Tokokino",
          url: "https://tokokino.com",
          description:
            "Browser-based screenshot beautifier. Style screenshots with backgrounds, shadows, device frames, text layers, and annotations, then export as PNG/JPEG/WebP or share a public link.",
          features: [
            "Device and browser frames (Safari, Chrome, Arc)",
            "Gradient, solid, and image backgrounds",
            "3D tilt and shadow effects",
            "Text and annotation layers",
            "Multi-screenshot layouts",
            "HD / 4K / 8K export",
            "Public share links",
          ],
          editorUrl: "https://tokokino.com/app",
        }),
      },
      { signal }
    )

    ctx.registerTool(
      {
        name: "upload-screenshot",
        title: "Upload Screenshot",
        description:
          "Open the file picker to upload a new screenshot into the editor.",
        inputSchema: { type: "object", properties: {}, required: [] },
        annotations: { readOnlyHint: false },
        execute: () => {
          const input =
            document.querySelector<HTMLInputElement>("input[type='file']")
          if (input) {
            input.click()
            return { status: "file picker opened" }
          }
          window.location.href = "/app"
          return { status: "redirecting to editor" }
        },
      },
      { signal }
    )

    ctx.registerTool(
      {
        name: "export-image",
        title: "Export Image",
        description:
          "Download the current canvas as a PNG, JPEG, or WebP image.",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["png", "jpeg", "webp"],
              description: "Image format (default: png)",
            },
          },
          required: [],
        },
        annotations: { readOnlyHint: false },
        execute: () => {
          const btn = document.querySelector<HTMLElement>(
            "[data-action='export']"
          )
          if (btn) {
            btn.click()
            return { status: "export dialog opened" }
          }
          return { status: "export button not found — open the editor first" }
        },
      },
      { signal }
    )

    ctx.registerTool(
      {
        name: "create-share-link",
        title: "Share Canvas",
        description:
          "Export the current canvas and create a public share link.",
        inputSchema: { type: "object", properties: {}, required: [] },
        annotations: { readOnlyHint: false },
        execute: () => {
          const btn = document.querySelector<HTMLElement>(
            "[data-action='share']"
          )
          if (btn) {
            btn.click()
            return { status: "share dialog opened" }
          }
          return { status: "share button not found — open the editor first" }
        },
      },
      { signal }
    )

    return () => controller.abort()
  }, [])

  return null
}
