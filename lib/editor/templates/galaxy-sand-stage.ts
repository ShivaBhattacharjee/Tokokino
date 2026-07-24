import type { Template } from "./types"
import { templateMeta } from "./catalog"

const galaxySandStage: Template = {
  ...templateMeta["galaxy-sand-stage"],
  state: {
    schemaVersion: 1,
    present: {
      activeTool: "pointer",
      aspect: {
        id: "auto",
        w: 0,
        h: 0,
      },
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
          screenshot: null,
          originalScreenshot: null,
          lastCropRegion: null,
          videoClips: null,
          background: {
            type: "image",
            value:
              "https://images.unsplash.com/photo-1504548840739-580b10ae7715?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MzIxNzl8MHwxfHNlYXJjaHwxMjN8fGRlc2VydHxlbnwxfDB8fHwxNzg0ODg3NTY2fDA&ixlib=rb-4.1.0&q=80&w=1080",
            sourceUrl:
              "https://images.unsplash.com/photo-1504548840739-580b10ae7715?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MzIxNzl8MHwxfHNlYXJjaHwxMjN8fGRlc2VydHxlbnwxfDB8fHwxNzg0ODg3NTY2fDA&ixlib=rb-4.1.0&q=80&w=1080",
            thumbUrl:
              "https://images.unsplash.com/photo-1504548840739-580b10ae7715?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5MzIxNzl8MHwxfHNlYXJjaHwxMjN8fGRlc2VydHxlbnwxfDB8fHwxNzg0ODg3NTY2fDA&ixlib=rb-4.1.0&q=80&w=400",
          },
          padding: 40,
          borderRadius: 7,
          canvasBorderRadius: 0,
          border: {
            color: null,
            width: 1,
            style: "solid",
            padding: 0,
          },
          backdrop: {
            effects: {
              noise: 0,
              blur: 0,
              brightness: 99,
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
          tilt: {
            rx: 0,
            ry: 0,
            rz: 0,
          },
          scale: 100,
          screenshotPosition: "center",
          screenshotOffset: {
            x: -8.075161637931053,
            y: -0.4069010416666874,
          },
          objectFit: "contain",
          screenshotLayer: {
            zIndex: 1,
            opacity: 100,
            blendMode: "normal",
            hidden: false,
          },
          shadow: {
            type: "hard",
            intensity: 56,
            lightSource: "0.00-4.00",
            color: "#050505",
          },
          overlay: {
            id: null,
            opacity: 50,
            position: "underlay",
          },
          frame: {
            id: "galaxy_s24_ultra",
            color: "grey",
            orientation: "vertical",
          },
          portrait: {
            mode: "off",
            intensity: 60,
            position: 50,
            distance: 50,
          },
          texts: [],
          assets: [],
          enhance: "off",
          annotations: [],
          annotationShapes: [],
          screenshotSlots: [],
          frameAddress: "",
          tweet: null,
          animation: {
            durationMs: 5000,
            clips: [],
          },
          id: "canvas-default",
          position: {
            x: 0,
            y: 0,
          },
          fullPageCapture: {
            scrollPosition: 0,
          },
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

export default galaxySandStage
