import { describe, expect, it, beforeEach } from "vitest"

import {
  DEFAULT_EXPORT_FILENAME_FORMAT,
  EXPORT_FILENAME_VARIABLES,
  applyExportFilenameFormat,
  buildExportFilename,
  exportTimestamp,
  getExportTemplateLabel,
  type ExportFilenameContext,
} from "@/lib/editor/export-filename"
import { useEditorStore } from "@/lib/editor/store"

const baseCtx: ExportFilenameContext = {
  date: "2026-07-12_16-18-18",
  template: "left-depth",
  scale: "hd",
  random: "abc123",
  width: 1920,
  height: 1080,
}

describe("export-filename", () => {
  describe("EXPORT_FILENAME_VARIABLES", () => {
    it("lists every supported token including RES", () => {
      const tokens = EXPORT_FILENAME_VARIABLES.map((v) => v.token)
      expect(tokens).toEqual([
        "{DATE}",
        "{TEMPLATE}",
        "{SCALE}",
        "{RES}",
        "{WIDTH}",
        "{HEIGHT}",
        "{RANDOM}",
      ])
    })
  })

  describe("applyExportFilenameFormat", () => {
    it("substitutes only tokens present in the format", () => {
      expect(
        applyExportFilenameFormat("tokokino_export_{SCALE}_{DATE}", baseCtx)
      ).toBe("tokokino_export_hd_2026-07-12_16-18-18")

      expect(applyExportFilenameFormat("shot_{RES}", baseCtx)).toBe(
        "shot_1920x1080"
      )

      expect(
        applyExportFilenameFormat("{TEMPLATE}_{WIDTH}x{HEIGHT}", baseCtx)
      ).toBe("left-depth_1920x1080")
    })

    it("leaves omitted tokens out of the filename", () => {
      const name = applyExportFilenameFormat("tokokino_{DATE}", baseCtx)
      expect(name).toBe("tokokino_2026-07-12_16-18-18")
      expect(name).not.toContain("hd")
      expect(name).not.toContain("1920")
      expect(name).not.toContain("abc123")
    })

    it("expands RES as width×height for still and video-sized exports", () => {
      expect(applyExportFilenameFormat("export_{RES}", baseCtx)).toBe(
        "export_1920x1080"
      )
      expect(
        applyExportFilenameFormat("export_{RES}", {
          ...baseCtx,
          width: 3840,
          height: 2160,
        })
      ).toBe("export_3840x2160")
    })

    it("expands all known tokens when included", () => {
      expect(
        applyExportFilenameFormat(
          "{TEMPLATE}_{SCALE}_{RES}_{WIDTH}_{HEIGHT}_{RANDOM}_{DATE}",
          baseCtx
        )
      ).toBe("left-depth_hd_1920x1080_1920_1080_abc123_2026-07-12_16-18-18")
    })

    it("sanitizes unsafe filename characters and spaces", () => {
      expect(
        applyExportFilenameFormat("my shot/{TEMPLATE}", {
          ...baseCtx,
          template: 'Cool: "Preset"?',
        })
      ).toBe("my_shot-Cool-_-Preset")
    })

    it("falls back when the format collapses to empty", () => {
      expect(applyExportFilenameFormat("***", baseCtx)).toBe("tokokino_export")
      expect(applyExportFilenameFormat("   ", baseCtx)).toBe("tokokino_export")
    })

    it("leaves unknown brace tokens untouched", () => {
      expect(applyExportFilenameFormat("file_{FOO}_{SCALE}", baseCtx)).toBe(
        "file_{FOO}_hd"
      )
    })
  })

  describe("buildExportFilename", () => {
    it("uses RES for screenshot-style png exports", () => {
      const name = buildExportFilename({
        format: "tokokino_export_{RES}_{SCALE}",
        scale: "4k",
        template: "default",
        width: 3840,
        height: 2160,
        extension: ".png",
      })
      expect(name).toBe("tokokino_export_3840x2160_4k.png")
    })

    it("normalizes extensions without a leading dot (video/gif)", () => {
      const name = buildExportFilename({
        format: "tokokino_export_{SCALE}_{RES}",
        scale: "hd",
        template: "default",
        width: 1080,
        height: 1920,
        extension: "mp4",
      })
      expect(name).toBe("tokokino_export_hd_1080x1920.mp4")
    })

    it("matches the default format shape", () => {
      expect(DEFAULT_EXPORT_FILENAME_FORMAT).toBe(
        "tokokino_export_{SCALE}_{DATE}"
      )
      const name = buildExportFilename({
        format: DEFAULT_EXPORT_FILENAME_FORMAT,
        scale: "hd",
        template: "default",
        width: 1920,
        height: 1080,
        extension: ".png",
      })
      expect(name).toMatch(
        /^tokokino_export_hd_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.png$/
      )
    })
  })

  describe("exportTimestamp", () => {
    it("formats an ISO timestamp for filenames", () => {
      expect(exportTimestamp(new Date("2026-07-12T16:18:18.123Z"))).toBe(
        "2026-07-12_16-18-18"
      )
    })
  })

  describe("getExportTemplateLabel", () => {
    beforeEach(() => {
      useEditorStore.getState().reset()
    })

    it("uses the canvas aspect ratio when no preset is active", () => {
      const id = useEditorStore.getState().present.activeCanvasId
      useEditorStore.getState().setAspect({ id: "16:9", w: 16, h: 9 })
      expect(getExportTemplateLabel(id)).toBe("16x9")
    })

    it("prefers the active single preset id", () => {
      const id = useEditorStore.getState().present.activeCanvasId
      useEditorStore.getState().setActiveSinglePresetId("left-depth")
      expect(getExportTemplateLabel(id)).toBe("left-depth")
    })
  })
})
