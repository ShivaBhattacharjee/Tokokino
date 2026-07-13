import { afterEach, describe, expect, it } from "vitest"

import {
  downloadDraftVideos,
  replaceUploadedDraftVideoSources,
  uploadDraftVideos,
} from "@/lib/draft-media-upload-client"
import { registerObjectUrl, revokeObjectUrl } from "@/lib/editor/media-type"

const originalXmlHttpRequest = globalThis.XMLHttpRequest

afterEach(() => {
  globalThis.XMLHttpRequest = originalXmlHttpRequest
})

describe("replaceUploadedDraftVideoSources", () => {
  it("replaces every matching video object URL without changing image sources", () => {
    const state = {
      canvases: [
        {
          screenshot: "blob:video-a",
          originalScreenshot: "blob:video-a",
          screenshotSlots: [
            { src: "blob:video-b" },
            { src: "data:image/png;base64,example" },
          ],
        },
      ],
    }

    expect(
      replaceUploadedDraftVideoSources(
        state,
        new Map([
          ["blob:video-a", "/api/drafts/media/media-a"],
          ["blob:video-b", "/api/drafts/media/media-b"],
        ])
      )
    ).toEqual({
      canvases: [
        {
          screenshot: "/api/drafts/media/media-a",
          originalScreenshot: "/api/drafts/media/media-a",
          screenshotSlots: [
            { src: "/api/drafts/media/media-b" },
            { src: "data:image/png;base64,example" },
          ],
        },
      ],
    })
  })
})

describe("uploadDraftVideos", () => {
  it("reports zero progress before the first upload progress event", async () => {
    class UploadRequest {
      status = 201
      responseText = '{"url":"/api/drafts/media/uploaded-video"}'
      upload: {
        onprogress?: (event: {
          lengthComputable: boolean
          loaded: number
        }) => void
      } = {}
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      open() {}
      setRequestHeader() {}
      send() {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 71 })
        this.onload?.()
      }
    }

    globalThis.XMLHttpRequest =
      UploadRequest as unknown as typeof XMLHttpRequest
    const source = registerObjectUrl(
      new Blob(["a".repeat(100)], { type: "video/mp4" })
    )
    const progress: number[] = []

    try {
      await uploadDraftVideos(
        {
          canvases: [
            {
              screenshot: source,
              originalScreenshot: null,
              screenshotSlots: [],
            },
          ],
        },
        ({ current }) => progress.push(current)
      )

      expect(progress).toEqual([0, 71, 100])
    } finally {
      revokeObjectUrl(source)
    }
  })
})

describe("downloadDraftVideos", () => {
  it("downloads saved video bytes before replacing saved URLs with local blob URLs", async () => {
    class DownloadRequest {
      status = 200
      response = new Blob(["a".repeat(100)], { type: "video/mp4" })
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      onprogress:
        | ((event: {
            lengthComputable: boolean
            loaded: number
            total: number
          }) => void)
        | null = null

      open() {}
      setRequestHeader() {}
      send() {
        this.onprogress?.({
          lengthComputable: true,
          loaded: 40,
          total: 100,
        })
        this.onload?.()
      }
    }

    globalThis.XMLHttpRequest =
      DownloadRequest as unknown as typeof XMLHttpRequest
    const progress: number[] = []

    const downloaded = await downloadDraftVideos(
      {
        canvases: [
          {
            screenshot:
              "/api/drafts/media/123e4567-e89b-42d3-a456-426614174000",
            originalScreenshot: null,
            screenshotSlots: [],
          },
        ],
      },
      ({ current }) => progress.push(current)
    )

    expect(progress).toEqual([0, 40, 100])
    expect(downloaded.canvases[0]?.screenshot).toMatch(/^blob:/)
    revokeObjectUrl(downloaded.canvases[0]?.screenshot)
  })
})
