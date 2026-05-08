import type {
  AnnotationBlurEffect,
  AnnotationLineStyle,
} from "@/lib/editor/store"

export type ResizeHandleId =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "ml"
  | "mr"
  | "mt"
  | "mb"

export const LINE_STYLES: { id: AnnotationLineStyle; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Short Dash" },
]

export const REDACTION_TEMPLATES: {
  id: AnnotationBlurEffect
  label: string
}[] = [
  { id: "blur", label: "Blur" },
  { id: "redact", label: "Solid redact" },
  { id: "redact-stripe", label: "Striped redact" },
  { id: "pixelate", label: "Pixel redact" },
]

export const RESIZE_HANDLES: ResizeHandleId[] = [
  "tl",
  "mt",
  "tr",
  "ml",
  "mr",
  "bl",
  "mb",
  "br",
]

export const ARROW_ENDPOINT_HANDLES: {
  id: "tail" | "head"
  className: string
}[] = [
  {
    id: "tail",
    className:
      "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing",
  },
  {
    id: "head",
    className:
      "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing",
  },
]

export const HANDLE_CLASS: Record<ResizeHandleId, string> = {
  tl: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  mt: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  tr: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  ml: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  mr: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  bl: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  mb: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  br: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
}
