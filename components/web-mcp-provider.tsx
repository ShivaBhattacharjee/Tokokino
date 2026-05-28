"use client"

import { useEffect } from "react"

export function WebMcpProvider() {
  useEffect(() => {
    if (!("modelContext" in navigator)) return

    const controller = new AbortController()
    const ctx = navigator.modelContext as {
      registerTool: (tool: object, opts: { signal: AbortSignal }) => void
    }
    const signal = controller.signal

    ctx.registerTool(
      {
        name: "create-share-link",
        description:
          "Export the current canvas as an image and create a public share link.",
        inputSchema: { type: "object", properties: {}, required: [] },
        execute: () => {
          const btn = document.querySelector<HTMLElement>(
            "[data-action='share']"
          )
          if (btn) btn.click()
          return { status: "share dialog opened" }
        },
      },
      { signal }
    )

    ctx.registerTool(
      {
        name: "upload-screenshot",
        description:
          "Open the file picker to upload a new screenshot to the editor.",
        inputSchema: { type: "object", properties: {}, required: [] },
        execute: () => {
          const input =
            document.querySelector<HTMLInputElement>("input[type='file']")
          if (input) input.click()
          return { status: "file picker opened" }
        },
      },
      { signal }
    )

    ctx.registerTool(
      {
        name: "export-image",
        description: "Download the current canvas as a PNG image.",
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
        execute: () => {
          const btn = document.querySelector<HTMLElement>(
            "[data-action='export']"
          )
          if (btn) btn.click()
          return { status: "export dialog opened" }
        },
      },
      { signal }
    )

    return () => controller.abort()
  }, [])

  return null
}
