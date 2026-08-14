export type ExportFormat = "png" | "jpeg" | "webp"
export type ExportResolution = "hd" | "4k" | "8k"
export type CopyResolution = "1080p"
export type ExportCaptureOptions = {
  watermark?: boolean
}

export const EXPORT_RESOLUTION_WIDTHS: Record<ExportResolution, number> = {
  hd: 1920,
  "4k": 3840,
  "8k": 7680,
}

export const EXPORT_RESOLUTION_LABELS: Record<ExportResolution, string> = {
  hd: "HD",
  "4k": "4K",
  "8k": "8K",
}

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  png: "PNG",
  jpeg: "JPEG",
  webp: "WebP",
}

export const EXPORT_FORMAT_EXTENSION: Record<ExportFormat, string> = {
  png: ".png",
  jpeg: ".jpeg",
  webp: ".webp",
}

export const COPY_RESOLUTION_WIDTHS: Record<CopyResolution, number> = {
  "1080p": 1080,
}

export const SHARE_RESOLUTION_WIDTH = 1920
