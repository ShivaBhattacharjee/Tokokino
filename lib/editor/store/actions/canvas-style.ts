import { LAYOUT_PRESETS, PRESENT_PRESETS } from "../../present-presets"
import {
  resolveActivePresetGeometry,
  resolveMainOffsetPx,
  resolveSlotPositionPct,
} from "../../preset-geometry"
import type { AspectState, Background, CanvasState } from "../../state-types"
import { getCanvasAnimation } from "../animation-helpers"
import {
  applyScreenshotStyle,
  applySharedFrameToCanvas,
  aspectRatioFromState,
  layoutSlotsInRow,
  screenshotStyleEffects,
  screenshotStyleGroup,
  scaleAnnotationStrokesForAspectChange,
  scaleScreenshotOffsetForAspectChange,
  stateCanvasAspect,
} from "../canvas-helpers"
import { moveLayerInStack } from "../layer-stack"
import type { CommitContext } from "../commit-context"
import type { EditorActions } from "../types"

const TWEET_POST_ASPECT: AspectState = { id: "x-post", w: 1080, h: 1080 }

export const createCanvasStyleActions = ({
  set,
  get,
  commit,
  commitCanvas,
  commitCanvasEffect,
}: CommitContext) =>
  ({
    setAspect: (a) => {
      const snapshot = get()
      commit((state) => {
        const currentAspect = stateCanvasAspect(state)
        const nextAspect = aspectRatioFromState(a)

        return {
          aspect: a,
          canvases: state.canvases.map((canvas) => {
            // Resolve the active preset (built-in *or* user-saved custom)
            // for *this* canvas's frame, so portrait-device variants kick
            // in correctly for layout presets.
            const activeGeometry = resolveActivePresetGeometry({
              activeLayoutPresetId: snapshot.activeLayoutPresetId,
              activeCustomPresetId: snapshot.activeCustomPresetId,
              layoutPresets: LAYOUT_PRESETS,
              customPresets: snapshot.customPresets,
              frame: canvas.frame,
            })
            const shouldReapply =
              activeGeometry !== null &&
              canvas.id === state.activeCanvasId &&
              canvas.screenshotSlots.length === activeGeometry.slots.length
            const activeSinglePreset =
              !activeGeometry && canvas.id === state.activeCanvasId
                ? PRESENT_PRESETS.find(
                    (preset) => preset.id === snapshot.activeSinglePresetId
                  )
                : undefined

            let screenshotSlots = layoutSlotsInRow(
              canvas.screenshotSlots,
              canvas.frame,
              nextAspect
            )
            if (shouldReapply && activeGeometry) {
              screenshotSlots = screenshotSlots.map((naturalSlot, index) => {
                const config = activeGeometry.slots[index]
                if (!config) return naturalSlot
                const { xPct, yPct } = resolveSlotPositionPct({
                  config,
                  naturalSlotXPct: naturalSlot.xPct,
                  relativeSlotPositions: activeGeometry.relativeSlotPositions,
                })
                return {
                  ...naturalSlot,
                  xPct,
                  yPct,
                  rotation: config.rotation,
                  tilt: config.tilt,
                  scale: config.scale,
                  ...(config.zIndex !== undefined && { zIndex: config.zIndex }),
                }
              })
            } else if (activeSinglePreset) {
              // Single presets track the canvas' current zoom (tilt-only).
              screenshotSlots = screenshotSlots.map((slot) => ({
                ...slot,
                yPct: 50,
                rotation: 0,
                tilt: activeSinglePreset.tilt,
                scale: canvas.scale,
              }))
            }

            const screenshotOffset =
              shouldReapply && activeGeometry
                ? resolveMainOffsetPx(activeGeometry.mainOffset)
                : scaleScreenshotOffsetForAspectChange(
                    canvas.screenshotOffset,
                    currentAspect,
                    nextAspect
                  )

            return {
              ...canvas,
              tilt:
                shouldReapply && activeGeometry
                  ? activeGeometry.canvasTilt
                  : activeSinglePreset
                    ? activeSinglePreset.tilt
                    : canvas.tilt,
              scale:
                shouldReapply && activeGeometry
                  ? activeGeometry.canvasScale
                  : canvas.scale,
              screenshotOffset,
              screenshotSlots,
              annotations: scaleAnnotationStrokesForAspectChange(
                canvas.annotations,
                currentAspect,
                nextAspect
              ),
            }
          }),
        }
      }, "aspect")
    },
    setCanvasAspect: (canvasId, a) => {
      const snapshot = get()
      commitCanvas(
        canvasId,
        (canvas, state) => {
          const currentAspect = aspectRatioFromState(
            canvas.aspect ?? state.aspect
          )
          const nextAspect = aspectRatioFromState(a)
          const activeGeometry = resolveActivePresetGeometry({
            activeLayoutPresetId: snapshot.activeLayoutPresetId,
            activeCustomPresetId: snapshot.activeCustomPresetId,
            layoutPresets: LAYOUT_PRESETS,
            customPresets: snapshot.customPresets,
            frame: canvas.frame,
          })
          const shouldReapply =
            activeGeometry !== null &&
            canvas.screenshotSlots.length === activeGeometry.slots.length
          const activeSinglePreset = !activeGeometry
            ? PRESENT_PRESETS.find(
                (preset) => preset.id === snapshot.activeSinglePresetId
              )
            : undefined

          let screenshotSlots = layoutSlotsInRow(
            canvas.screenshotSlots,
            canvas.frame,
            nextAspect
          )
          if (shouldReapply && activeGeometry) {
            screenshotSlots = screenshotSlots.map((naturalSlot, index) => {
              const config = activeGeometry.slots[index]
              if (!config) return naturalSlot
              const { xPct, yPct } = resolveSlotPositionPct({
                config,
                naturalSlotXPct: naturalSlot.xPct,
                relativeSlotPositions: activeGeometry.relativeSlotPositions,
              })
              return {
                ...naturalSlot,
                xPct,
                yPct,
                rotation: config.rotation,
                tilt: config.tilt,
                scale: config.scale,
                ...(config.zIndex !== undefined && { zIndex: config.zIndex }),
              }
            })
          } else if (activeSinglePreset) {
            // Single presets track the canvas' current zoom (tilt-only).
            screenshotSlots = screenshotSlots.map((slot) => ({
              ...slot,
              yPct: 50,
              rotation: 0,
              tilt: activeSinglePreset.tilt,
              scale: canvas.scale,
            }))
          }

          return {
            aspect: a,
            tilt:
              shouldReapply && activeGeometry
                ? activeGeometry.canvasTilt
                : activeSinglePreset
                  ? activeSinglePreset.tilt
                  : canvas.tilt,
            scale:
              shouldReapply && activeGeometry
                ? activeGeometry.canvasScale
                : canvas.scale,
            screenshotOffset:
              shouldReapply && activeGeometry
                ? resolveMainOffsetPx(activeGeometry.mainOffset)
                : scaleScreenshotOffsetForAspectChange(
                    canvas.screenshotOffset,
                    currentAspect,
                    nextAspect
                  ),
            screenshotSlots,
            annotations: scaleAnnotationStrokesForAspectChange(
              canvas.annotations,
              currentAspect,
              nextAspect
            ),
          }
        },
        "aspect"
      )
    },
    setBackground: (b, canvasId, opts) => {
      // The canvas-view hydration effect re-applies image backgrounds as an
      // optimized value (library/Unsplash URL → downscaled data URL) on reload.
      // That's an internal swap of the SAME background, not a user edit, so in
      // Animate mode it must NOT be recorded as a "background" keyframe effect —
      // otherwise reopening a draft spuriously marks the open clip as animating
      // the background. Swap the value on the committed canvas and on any clip
      // pose holding the same source, leaving `effects` untouched.
      if (opts?.silent) {
        commitCanvas(
          canvasId,
          (canvas) => {
            const anim = getCanvasAnimation(canvas)
            if (anim.clips.length === 0) return { background: b }
            const prev = canvas.background
            const matchesPrev = (bg: Background | undefined) =>
              bg?.type === "image" &&
              prev.type === "image" &&
              bg.sourceUrl === prev.sourceUrl
            const clips = anim.clips.map((c) => {
              const pose =
                c.pose && matchesPrev(c.pose.background)
                  ? { ...c.pose, background: b }
                  : c.pose
              const baseline =
                c.baseline && matchesPrev(c.baseline.background)
                  ? { ...c.baseline, background: b }
                  : c.baseline
              if (pose === c.pose && baseline === c.baseline) return c
              return { ...c, pose, baseline }
            })
            return { background: b, animation: { ...anim, clips } }
          },
          "background"
        )
        return
      }
      commitCanvasEffect(
        canvasId,
        { background: b },
        "background",
        "background"
      )
    },
    setPadding: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "all", { padding: n }),
        "padding",
        "padding"
      ),
    setBorderRadius: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "all", { borderRadius: n }),
        "borderRadius",
        "borderRadius"
      ),
    setCanvasBorderRadius: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        { canvasBorderRadius: n },
        "canvasBorderRadius",
        "canvasRadius"
      ),
    setBorder: (b, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "all", { border: b }),
        "border",
        "border"
      ),
    setMainScreenshotPadding: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "main", { padding: n }),
        "padding",
        "padding"
      ),
    setMainScreenshotBorderRadius: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "main", { borderRadius: n }),
        "borderRadius",
        "borderRadius"
      ),
    setMainScreenshotBorder: (b, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "main", { border: b }),
        "border",
        "border"
      ),
    setBackdropEffects: (e, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, effects: e } }),
        "backdrop-effects",
        "backdrop"
      ),
    setBackdropPattern: (p, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, pattern: p } }),
        "backdrop-pattern",
        "pattern"
      ),
    setBackdropAscii: (a, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, ascii: a } }),
        "backdrop-ascii"
      ),
    setBackdropLighting: (l, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "all", { lighting: l }),
        "backdrop-lighting",
        "lighting"
      ),
    setMainScreenshotBackdropLighting: (l, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "main", { lighting: l }),
        "backdrop-lighting",
        "lighting"
      ),
    setBackdropFilter: (f, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => ({ backdrop: { ...canvas.backdrop, filter: f } }),
        "backdrop-filter",
        "filter"
      ),
    setTilt: (t, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "main", { tilt: t }),
        "tilt",
        "tilt"
      ),
    setScale: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "main", { scale: n }),
        "scale",
        "zoom"
      ),
    setTiltAndScale: (t, scale, canvasId) =>
      commitCanvasEffect(canvasId, { tilt: t, scale }, "tilt-scale", [
        "tilt",
        "zoom",
      ]),
    setScreenshotTilt: (t, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "all", { tilt: t }),
        "tilt",
        "tilt"
      ),
    setScreenshotScale: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "all", { scale: n }),
        "scale",
        "zoom"
      ),
    setScreenshotRotation: (n, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "all", { rotation: n }),
        "tilt",
        "tilt"
      ),
    setCanvasZoom: (n) => commit({ canvasZoom: n }, "canvasZoom"),
    setScreenshotPosition: (p, canvasId) =>
      commitCanvasEffect(
        canvasId,
        { screenshotPosition: p, screenshotOffset: { x: 0, y: 0 } },
        "screenshotPosition",
        "position"
      ),
    setScreenshotOffset: (o, canvasId) =>
      commitCanvasEffect(
        canvasId,
        { screenshotOffset: o },
        "screenshotOffset",
        "position"
      ),
    setScreenshotPlacement: (p, o, canvasId) =>
      commitCanvasEffect(
        canvasId,
        { screenshotPosition: p, screenshotOffset: o },
        "screenshotPlacement",
        "position"
      ),
    updateScreenshotLayer: (patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => ({
          screenshotLayer: { ...canvas.screenshotLayer, ...patch },
        }),
        "screenshotLayer"
      ),
    applyScreenshotStyle: (target, patch, canvasId) => {
      const scope =
        target === "main" || target === "all" ? target : `slot-${target.slotId}`
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, target, patch),
        `${screenshotStyleGroup(patch)}:${scope}`,
        screenshotStyleEffects(patch)
      )
    },
    setShadow: (s, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "all", { shadow: s }),
        "shadow",
        "shadow"
      ),
    setMainScreenshotShadow: (s, canvasId) =>
      commitCanvasEffect(
        canvasId,
        (canvas) => applyScreenshotStyle(canvas, "main", { shadow: s }),
        "shadow",
        "shadow"
      ),
    setOverlay: (o, canvasId) =>
      commitCanvasEffect(canvasId, { overlay: o }, "overlay", "overlay"),
    setFrame: (f, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => {
          if (canvas.tweet) {
            return {
              frame: { id: "none", color: "black", orientation: "vertical" },
              frameAddress: "",
            }
          }
          return applySharedFrameToCanvas(
            canvas,
            state,
            f,
            get().activeLayoutPresetId
          )
        },
        "frame"
      ),
    setFrameForMatchingScreenshots: (f, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas, state) => {
          if (canvas.tweet) {
            return {
              frame: { id: "none", color: "black", orientation: "vertical" },
              frameAddress: "",
            }
          }
          // Strip overrides *before* reflow so row math packs everyone as the
          // shared frame (not the pre-apply mixed-frame widths).
          const withoutSlotFrames: CanvasState = {
            ...canvas,
            screenshotSlots: canvas.screenshotSlots.map((slot) =>
              slot.frame ? { ...slot, frame: undefined } : slot
            ),
          }
          return applySharedFrameToCanvas(
            withoutSlotFrames,
            state,
            f,
            get().activeLayoutPresetId
          )
        },
        "frame"
      ),
    setMainScreenshotFrame: (f, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => {
          if (canvas.tweet) {
            return {
              frame: { id: "none", color: "black", orientation: "vertical" },
              frameAddress: "",
            }
          }
          // The main has no frame of its own — it uses the canvas frame, which
          // every un-overridden slot inherits. To change ONLY the main, pin each
          // inheriting slot to the previous frame so it stays put.
          const previousFrame = canvas.frame
          return {
            frame: { ...f },
            screenshotSlots: canvas.screenshotSlots.map((slot) =>
              slot.frame ? slot : { ...slot, frame: { ...previousFrame } }
            ),
          }
        },
        "frame"
      ),
    setFrameAddress: (address, canvasId) =>
      commitCanvas(canvasId, { frameAddress: address }, "frame-address"),
    setTweet: (card, canvasId) => {
      commit((state) => {
        const targetId = canvasId ?? state.activeCanvasId
        return {
          aspect: { ...TWEET_POST_ASPECT },
          canvases: state.canvases.map((canvas) =>
            canvas.id === targetId
              ? {
                  ...canvas,
                  // A tweet replaces the screenshot as the canvas's main content.
                  tweet: card,
                  screenshot: null,
                  originalScreenshot: null,
                  lastCropRegion: null,
                  fullPageCapture: null,
                  videoClips: null,
                  screenshotSlots: [],
                  frame: {
                    id: "none",
                    color: "black",
                    orientation: "vertical",
                  },
                  frameAddress: "",
                  screenshotPosition: "center",
                  screenshotOffset: { x: 0, y: 0 },
                  aspect: undefined,
                }
              : canvas
          ),
        }
      }, null)
      set({
        presetTab: "single",
        activeLayoutPresetId: null,
        activeCustomPresetId: null,
      })
    },
    updateTweet: (patch, canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) =>
          canvas.tweet ? { tweet: { ...canvas.tweet, ...patch } } : {},
        "tweet"
      ),
    clearTweet: (canvasId) => commitCanvas(canvasId, { tweet: null }, null),
    setObjectFit: (fit, canvasId) =>
      commitCanvas(canvasId, { objectFit: fit }, "objectFit"),
    bringScreenshotToFront: (canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, "screenshot", "front"),
        "screenshot-layer"
      ),
    sendScreenshotToBack: (canvasId) =>
      commitCanvas(
        canvasId,
        (canvas) => moveLayerInStack(canvas, "screenshot", "back"),
        "screenshot-layer"
      ),
    setPortrait: (p, canvasId) =>
      commitCanvasEffect(canvasId, { portrait: p }, "portrait", "portrait"),
    setEnhance: (e, canvasId) =>
      commitCanvas(canvasId, { enhance: e }, "enhance"),
  }) satisfies Partial<EditorActions>
