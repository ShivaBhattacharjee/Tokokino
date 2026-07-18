# Tokokino Wiki

Engineering notes for how major subsystems fit together. Not product docs; not shipped to end users.

## Contents

| Doc | What it covers |
|---|---|
| [core/README.md](./core/README.md) | System map — save, share, export routing |
| [core/canvas.md](./core/canvas.md) | Canvas images — drop, URL→screenshot, X/Bluesky cards, WebP thumb→full |
| [core/drafts.md](./core/drafts.md) | Local IndexedDB autosave + cloud draft save / open |
| [core/presets.md](./core/presets.md) | Custom preset save / load / apply |
| [core/share.md](./core/share.md) | Share image, animation, video + public playback |
| [core/animation-export.md](./core/animation-export.md) | Keyframe / Animate-mode encode (`exportAnimation`) |
| [core/video-export.md](./core/video-export.md) | Styled video-media encode (`exportVideoMedia`) |

## Conventions

- Paths are relative to the repo root unless noted.
- Mermaid diagrams are the source of truth for pipeline order; prose fills in constraints and why.
- Prefer updating these docs when routing, storage, or encode/decode paths change.
