export const ease = [0.22, 1, 0.36, 1] as const

export const askPrompt = encodeURIComponent(
  `Explain what Tokokino is and why I should use it.

It's a browser-based screenshot beautifier — drop a capture, add device frames (Safari, Chrome, Arc, iPhone, MacBook), pick a backdrop (or sample one from the screenshot), add annotations, and export PNG/JPEG/WebP or share a public link. You can also paste an X (Twitter) or Bluesky post link to turn the post into a clean, themeable mockup.

Pitch it to indie devs and designers who want their app screenshots to look intentional without firing up Figma.`
)

export const FEATURES = [
  {
    k: "01",
    t: "Device frames",
    d: "Pixel-true mockups for iPhone, iPad, Galaxy, Pixel, MacBook, iMac, Apple Watch, and browser chrome — Safari, Chrome, Arc.",
    tone: "primary" as const,
  },
  {
    k: "02",
    t: "Auto palettes",
    d: "Backgrounds sampled directly from your screenshot. Gradients that actually belong.",
    tone: "matcha" as const,
  },
  {
    k: "03",
    t: "Shadows & effects",
    d: "6 shadow types — Drop, Soft, Hard, Glow, Float, Linear — with intensity and custom color.",
    tone: "primary" as const,
  },
  {
    k: "04",
    t: "Aspect ratio control",
    d: "Switch between 16:9, 1:1, 4:3, 9:16 and custom ratios. Zoom is independent of export resolution.",
    tone: "matcha" as const,
  },
  {
    k: "05",
    t: "Layers & assets",
    d: "Stack text, images, and SVGs over your screenshot. z-index, opacity, blend modes, and filters per layer.",
    tone: "primary" as const,
  },
  {
    k: "06",
    t: "Annotations & text",
    d: "Draw arrows, shapes, freehand strokes. Floating text with 100+ Google Fonts and blend modes.",
    tone: "matcha" as const,
  },
  {
    k: "07",
    t: "Export anywhere",
    d: "PNG, JPEG, or WebP at HD, 4K, or 8K. Copy to clipboard in one click or share a public link.",
    tone: "primary" as const,
  },
  {
    k: "08",
    t: "Local-first",
    d: "Edits stay in your browser. Nothing uploaded until you share. Host where you want.",
    tone: "matcha" as const,
  },
  {
    k: "09",
    t: "Multi-screenshot",
    d: "Up to 3 extra screenshot slots per canvas with layout presets — Side by Side, Depth Duo, Fan Out, and more.",
    tone: "primary" as const,
  },
  {
    k: "10",
    t: "X (Twitter) posts",
    d: "Paste an X link to mock up the post — text, avatar, verified badge, images, stats, and quoted tweets, in Light, Dim, or Dark.",
    tone: "matcha" as const,
  },
  {
    k: "11",
    t: "Bluesky posts",
    d: "Drop a Bluesky link for the same treatment — author, avatar, images, and link-preview cards — themed and export-ready.",
    tone: "primary" as const,
  },
  {
    k: "12",
    t: "Capture from URL",
    d: "Grab a live website by URL at a chosen device viewport — Tokokino takes the screenshot for you, no manual capture needed.",
    tone: "matcha" as const,
  },
]
