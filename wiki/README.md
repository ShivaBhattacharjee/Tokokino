# Tokokino Wiki

Engineering notes for how major subsystems fit together. Not product docs; not shipped to end users.

## Contents

### Overview

| Doc | What it covers |
|---|---|
| [core/README.md](./core/README.md) | System map — save, share, export routing, persistence |
| [core/architecture.md](./core/architecture.md) | Full app architecture — every module / feature map |

### Editor core

| Doc | What it covers |
|---|---|
| [core/editor-store.md](./core/editor-store.md) | Zustand store, history, types, commit paths |
| [core/canvas.md](./core/canvas.md) | Canvas images — drop, URL→screenshot, X/Bluesky, WebP thumbs |
| [core/video-canvas.md](./core/video-canvas.md) | Video/GIF intake, control bar, trim, export routing |
| [core/device-frames.md](./core/device-frames.md) | Device mockups + browser chrome + glass frames + export chrome |
| [core/styling-canvas.md](./core/styling-canvas.md) | Inspector → store → CSS → canvas paint pipeline |
| [core/ascii-backdrop.md](./core/ascii-backdrop.md) | ASCII backdrop texture + Animate stack |
| [core/live-preview.md](./core/live-preview.md) | Slider/drag CSS vars without store commits |
| [core/layers.md](./core/layers.md) | Text, assets, annotations, multi-screenshot slots |
| [core/animate-mode.md](./core/animate-mode.md) | Animate timeline, playback, effect ownership |
| [core/bulk-preview.md](./core/bulk-preview.md) | Multi-canvas bulk edit + full-screen preview |
| [core/shortcuts.md](./core/shortcuts.md) | Keyboard shortcuts catalog + handlers |

### Save / share / export

| Doc | What it covers |
|---|---|
| [core/drafts.md](./core/drafts.md) | Local IndexedDB autosave + cloud draft save / open |
| [core/presets.md](./core/presets.md) | Custom preset save / load / apply |
| [core/templates.md](./core/templates.md) | Curated in-repo templates gallery |
| [core/share.md](./core/share.md) | Share image, animation, video + public playback |
| [core/shares-gallery.md](./core/shares-gallery.md) | User share library (`/app/shares`) + stats |
| [core/still-export.md](./core/still-export.md) | Still PNG/JPEG/WebP capture & download (WebKit settle, glass frost) |
| [core/animation-export.md](./core/animation-export.md) | Keyframe / Animate-mode encode (Safari layer cache, workers) |
| [core/video-export.md](./core/video-export.md) | Styled video-media encode (+ dav1d WASM) |

### Platform, site & integrations

| Doc | What it covers |
|---|---|
| [core/platform.md](./core/platform.md) | Deploy (OpenNext/Workers), D1, R2, rate limits, env |
| [core/auth-account.md](./core/auth-account.md) | Auth, sessions, preferences, account deletion |
| [core/integrations.md](./core/integrations.md) | Unsplash, screenshot, tweet, image proxy, feedback |
| [core/offline.md](./core/offline.md) | Offline editor shell (service worker + cache) |
| [core/web-mcp.md](./core/web-mcp.md) | Browser agent tools (`modelContext`) |
| [core/marketing-site.md](./core/marketing-site.md) | Landing, compare, showcase, legal, SEO |

## Conventions

- Paths are relative to the repo root unless noted.
- Mermaid diagrams are the source of truth for pipeline order; prose fills in constraints and why.
- Prefer updating these docs when routing, storage, encode/decode, or module boundaries change.
- Agent task patterns live in `agents.md` / `CLAUDE.md` at the repo root — the wiki is the deeper architectural reference.
