import type { Template } from "./types"
import { templateMeta } from "./catalog"

const browserDark: Template = {
  ...templateMeta["browser-dark"],
  state: {
    schemaVersion: 1,
    present: {
      activeTool: "pointer",
      aspect: { id: "auto", w: 0, h: 0 },
      canvasZoom: 100,
      annotation: {
        mode: "pen",
        color: "#ef4444",
        strokeWidth: 4,
        lineStyle: "solid",
        blurEffect: "blur",
        blurAmount: 14,
      },
      canvases: [
        {
          screenshot: "https://assets.tokokino.com/demos/framer.png",
          originalScreenshot: "https://assets.tokokino.com/demos/framer.png",
          lastCropRegion: null,
          videoClips: null,
          background: {
            type: "image",
            value:
              "https://assets.tokokino.com/Backgrounds/Mac/mac-asset-8.jpg",
            sourceUrl:
              "https://assets.tokokino.com/Backgrounds/Mac/mac-asset-8.jpg",
            thumbUrl:
              "https://assets.tokokino.com/Backgrounds/Mac/thumbs/mac-asset-8.webp",
          },
          padding: 24,
          borderRadius: 7,
          canvasBorderRadius: 0,
          border: { color: null, width: 1, style: "solid", padding: 0 },
          backdrop: {
            effects: {
              noise: 0,
              blur: 0,
              brightness: 100,
              contrast: 100,
              saturation: 100,
              hue: 0,
              grayscale: 0,
              sepia: 0,
              invert: 0,
              opacity: 100,
            },
            pattern: {
              ids: [],
              intensity: 50,
              thickness: 1,
              color: "#FFFFFF",
            },
            lighting: {
              target: "inner",
              intensity: 0,
              direction: "0-0",
              color: "#FFFFFF",
            },
            filter: "none",
          },
          tilt: { rx: 0, ry: 0, rz: 0 },
          scale: 100,
          screenshotPosition: "center",
          screenshotOffset: { x: 0, y: 0 },
          objectFit: "contain",
          screenshotLayer: {
            zIndex: 2,
            opacity: 100,
            blendMode: "normal",
            hidden: false,
          },
          shadow: {
            type: "drop",
            intensity: 100,
            lightSource: "0.00-0.00",
            color: "#050505",
          },
          overlay: { id: null, opacity: 50, position: "overlay" },
          frame: { id: "browser", color: "dark", orientation: "horizontal" },
          portrait: { mode: "off", intensity: 60, position: 50, distance: 50 },
          texts: [],
          assets: [],
          enhance: "off",
          annotations: [],
          annotationShapes: [],
          screenshotSlots: [],
          frameAddress: "framer.com",
          tweet: null,
          animation: { durationMs: 5000, clips: [] },
          id: "canvas-default",
          position: { x: 0, y: 0 },
          fullPageCapture: { scrollPosition: 0 },
        },
      ],
      activeCanvasId: "canvas-default",
    },
    ui: {
      presetTab: "single",
      activeLayoutPresetId: null,
      activeCustomPresetId: null,
      activeSinglePresetId: null,
      bulkEditMode: false,
      bulkViewportZoom: 1,
      bulkScale: 65,
      previewAutoScrollDelay: 3000,
      previewAnimation: "slide",
      isAnimateMode: false,
    },
  },
}

export default browserDark
