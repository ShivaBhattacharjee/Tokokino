/**
 * Public surface of the still-export pipeline. The implementation is split
 * across the sibling `export-*` modules, in dependency order:
 *
 *   export-constants      formats, resolutions, output widths
 *   export-dom            finding the canvas node and measuring it
 *   export-assets         which URLs need the CORS proxy
 *   export-asset-rewrite  proxying the clone's assets and preloading them
 *   export-embed          inlining images/backgrounds as data URIs
 *   export-raster         foreignObject serialization + canvas encoding
 *   export-settle         the WebKit "best of N rasters" loop
 *   export-glass          baking glass-frame frost that backdrop-filter can't
 *   export-clone          the offscreen clone, override stylesheet, watermark
 *   export-still          exportCanvas / captureCanvasAsPngBlob / clipboard
 *   export-share          share capture with the JPEG size fallback
 *   export-thumbnail      draft + image thumbnails
 *   export-animation-capture  the two Animate-mode frame capture strategies
 */

export { shouldProxyAssetUrl } from "./export-assets"

export {
  COPY_RESOLUTION_WIDTHS,
  EXPORT_FORMAT_EXTENSION,
  EXPORT_FORMAT_LABELS,
  EXPORT_RESOLUTION_LABELS,
  EXPORT_RESOLUTION_WIDTHS,
  SHARE_RESOLUTION_WIDTH,
  type CopyResolution,
  type ExportCaptureOptions,
  type ExportFormat,
  type ExportResolution,
} from "./export-constants"

export {
  elementRotation,
  exportElementLayoutSize,
  getCanvasRenderedDims,
  getOutputDims,
} from "./export-dom"

export { collectEmbeddedImageUrls } from "./export-embed"

export { exportScaleStyle } from "./export-raster"

export {
  INITIAL_SETTLE_PROGRESS,
  advanceSettle,
  isRasterEssentiallyEmpty,
  rasterSignatureDelta,
  settleDelayMs,
  signatureCoverage,
  type SettleProgress,
} from "./export-settle"

export {
  flattenGlassChromeRing,
  neutralizeUnsupportedExportBackdropFilters,
} from "./export-glass"

export {
  captureCanvasAsPngBlob,
  copyCanvasAsFormat,
  copyCanvasAsPng,
  exportCanvas,
} from "./export-still"

export { captureCanvasForShare } from "./export-share"

export {
  captureCanvasThumbnail,
  createImageThumbnailBlob,
} from "./export-thumbnail"

export {
  prepareAnimationCapture,
  prepareFastAnimationCapture,
  type AnimationCapture,
} from "./export-animation-capture"
