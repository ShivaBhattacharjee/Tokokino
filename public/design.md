---
name: tokokino-design
description: The measured visual language of Tokokino — tokens, type scale, component specs, and layout rules for coding agents building or extending its surfaces.
source: https://tokokino.com
canonical: https://tokokino.com/design.md
measured: landing page and /app editor shell, 2026-08-07, 1512×812 at DPR 2, light and dark
---

# Build Tokokino surfaces

Act as a design engineer working inside an existing, opinionated system. Every value below was read from `getComputedStyle` on the running app, not inferred from intent. Reuse the tokens; do not restate them as literals. When a value is not listed here, derive it from the nearest listed token rather than inventing a new one.

The system's character is **restraint under density**: near-neutral greys carrying one saturated accent, borders instead of shadows, tight negative tracking on headings, and two motion durations for the entire product. Additive decoration reads as foreign here.

---

## Visual Theme & Atmosphere

A precision-instrument surface. The page is an off-white or near-black field with almost no chroma; a single coral-red accent carries every action, and a muted green appears only as a secondary state wash. Structure is drawn, not lit — dashed 1px rails run down the page margins and between sections, and small plus-shaped crop marks pin the corners of framed regions. The effect is a drafting sheet or a camera viewfinder, which suits a screenshot composer: the chrome announces measurement.

Marketing and editor share one token set but differ in density. Marketing breathes (96px section rhythm, 67px display type). The editor is compact and instrument-like — 28px control rows, 12px labels, fixed side rails. Both are surface-flat: nothing floats.

---

## Color Palette & Roles

All colors are authored in `oklch` and consumed as CSS variables. Hex values below are the resolved sRGB output. Role names, never brand names.

| Role | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#f9fafa` | `#0f0f0f` | Page field |
| `--foreground` | `#0a090a` | `#f5f5f5` | Primary text |
| `--card` | `#ffffff` | `#141414` | Raised surface |
| `--popover` | `#ffffff` | `#181818` | Overlay surface |
| `--primary` | `#e93954` | `#ff5d6e` | Sole action color |
| `--primary-foreground` | `#fdfcf5` | `#fdfcf5` | Text on primary |
| `--secondary` / `--muted` | `#f0f0f0` | `#1b1b1b` | Inert fill |
| `--secondary-foreground` | `#181818` | `#f5f5f5` | Text on inert fill |
| `--muted-foreground` | `#717171` | `#868586` | Secondary text |
| `--accent` | `#b6e7b6` @22% | `#0e3911` @27% | Selected/active wash |
| `--accent-foreground` | `#207029` | `#81dd85` | Text on accent |
| `--destructive` | `#e7000b` | `#ff6467` | Danger |
| `--border` / `--input` | `#dddede` | `#ffffff` @12% / @14% | Hairlines |
| `--ring` | `#e93954` | `#ff5d6e` | Focus |
| `--sidebar` | `#f8f8f8` | `#0f0f0f` | Editor rails |

Two derived tokens carry the drafting motif:

```css
--rail: color-mix(in oklch, var(--foreground) 20%, transparent); /* dashed rules */
--selection-bg: /* light */ #e93953 @28%;  /* dark */ #88db8b @30%;
```

Rules: `--primary` is reserved for the single highest-intent action per view. `--accent` never fills a button — it marks state. Dark-mode borders are alpha-white, not a grey hex, so they hold on any surface.

---

## Typography Rules

**Stack.** `--font-sans: "Geist", "Geist Fallback"` and `--font-mono: "Geist Mono", "Geist Mono Fallback"`, loaded via `next/font/google` and self-hosted at build. Geist is published under the SIL Open Font License 1.1 — confirm the current license text before redistributing the files. No other family appears in the UI. Sixteen further Google families (Inter, Playfair Display, Caveat, Doto, …) are registered with `preload: false` and are **canvas content fonts only** — never use them for interface text.

**Measured scale** (weights are 400/500/600 only; no bold):

| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| Display `h1` | `clamp(1.4rem, 0.85rem + 3.8vw, 1.625rem)` → `sm:3rem` → `lg:4.2rem` (67.2px), lh 1.06–1.1 | 500 | −0.035em → −0.03em |
| Section `h2` | 36px / 40px (also 30px / 36px) | 400 | −0.025em |
| Card `h3` | 14px / 21px | 600 | −0.025em |
| Lead | 15px / 1.625 at `--foreground` @60% | 400 | normal |
| Body / caption | 13px / 1.625 at `--foreground` @50–60% | 400 | normal |
| UI control | 12px | 400–500 | normal |
| Eyebrow (`.label-eyebrow`) | mono 10px, uppercase | 400 | 0.16em |

Headings tighten as they grow; body text never gets negative tracking. Only the eyebrow is uppercase, only the eyebrow is mono, and only the eyebrow tracks positive. Long headings use `text-balance`; lead paragraphs cap at `max-w-xl`.

---

## Component Stylings

Radius derives from one root: `--radius: 0.7rem` (11.2px), with `sm ×0.6` (6.7px), `md ×0.8` (8.96px), `lg ×1` , `xl ×1.4`, `2xl ×1.8`, `3xl ×2.2`.

**Button.** `rounded-md` (8.96px), `border border-transparent`, weight 500, `transition-all`, `active:translate-y-px`, focus `border-ring` + `ring-2 ring-ring/30`. No shadow in any variant. Default size is `h-7` (28px) at 12px — the product's baseline control height. Marketing CTAs scale up to 40px / 14px / `10px 20px` padding with an 8px gap.

| Variant | Fill | Text | Hover |
|---|---|---|---|
| default | `--primary` | `#fdfcf5` | `primary/80` |
| outline | transparent, `--border` | `--foreground` | `input/50` |
| secondary | `--secondary` | `--secondary-foreground` | `secondary/80` |
| ghost | none | inherit | `--muted` |
| destructive | `destructive/10` | `--destructive` | `destructive/20` |

**Card.** `rounded-lg`, `bg-card`, `ring-1 ring-foreground/10`, `py-4`, `gap-4`, 12px body text, `overflow-hidden`. Marketing variants swap the ring for `border-border/60` and a translucent `background/40` fill with `backdrop-blur`.

**Input.** `h-7`, `rounded-md`, `border-input`, `bg-input/20` (`/30` dark), `px-2`, `shadow-none`. Focus sets `border-primary` and explicitly removes the ring — inputs signal focus by border color alone, buttons by ring. Preserve that split.

**Nav.** 48px header, transparent, no blur, no bottom border. Links are 12px at `--foreground` @60%, `rounded-[4px]`, `6px 10px` padding, resolving to full-opacity foreground on hover. A single primary CTA sits at the end of the row.

---

## Layout Principles

One container: `max-w-[76rem]` (1216px), width `calc(100% - 1rem)` widening to `-2rem` at `sm`. Content inside it caps again at `max-w-5xl` (1024px) for hero blocks and `max-w-xl` for prose. The editor shell uses a different ceiling — `max-w-[1800px]` with a 268px left rail and a ~260–308px right inspector, both on `--sidebar`.

Vertical rhythm is two values: `py-16` (64px) rising to `sm:py-24` (96px) for standard sections; the hero runs `pt-14/pb-14` → 80px. Horizontal padding steps `px-5` → `sm:px-8` → `lg:px-12` (20 / 32 / 48px).

Spacing uses the 4px Tailwind scale, concentrated at 4, 6, 8, 12, 16, 20, 32, 48, 64, 96. Section boundaries are marked by a full-bleed dashed rule (`99.6vw`), not by a background change.

---

## Depth & Elevation

**There are zero box-shadows on the marketing site.** Every element measured returned `box-shadow: none`. Components opt out explicitly — `Input` sets `shadow-none`, `Button` defines no shadow in any variant. Treat elevation as a non-feature.

Separation comes from four devices, in order of preference:

1. **Hairlines** — `1px` at 5–12% alpha (`--border`), or `ring-1 ring-foreground/10`.
2. **Surface alpha** — panels sit at `background/40`–`/60` over the field rather than at a lighter hex.
3. **Backdrop blur** — `blur(8px)` on inner cards, `blur(12px)` on outer containers. This is the only "lift" in the system.
4. **Nested radii** — containers step `20px → 14px → 9px/8px` inward, so concentric corners stay optically parallel.

Shadow tokens exist in the canvas engine (`shadowCss()`), but those render *inside the user's artwork*. Never let canvas shadow vocabulary leak into interface chrome.

---

## Do's and Don'ts

**Do**

- Reach for a hairline, a translucent surface, or a radius step when you need separation.
- Keep `--primary` to one action per view; let everything else be `ghost` or `outline`.
- Tighten tracking as type scales up; leave body copy at `normal`.
- Hold control height at `h-7` / 12px inside the editor, even when it feels cramped.
- Nest radii inward and mark framed regions with the corner-plus markers.

**Don't**

- Add `box-shadow`, glow, or a gradient fill to any interface element.
- Introduce a second accent hue, or use `--accent` green as a button fill.
- Use uppercase or letter-spacing on anything but the mono eyebrow.
- Pull an editor canvas font (Playfair, Caveat, Doto) into UI text.
- Invent a duration. There are two: 150ms and 500ms.
- Put a border *and* a ring on the same element, or a focus ring on an input.
- Round a marketing card to an arbitrary pixel value outside the 8/9/14/20 set.

---

## Responsive Behavior

Standard Tailwind breakpoints — `sm` 640, `md` 768, `lg` 1024, `xl` 1280. Measured at 1512px; smaller-viewport behavior below is read from the live class attributes rather than from a rendered narrow viewport.

Three things scale together and should stay in step: display type (`1.4rem` → `3rem` → `4.2rem`), section padding (`20/64px` → `32/96px` → `48px`), and lead copy (13px → 15px). Everything else is fixed — control heights, radii, borders, and the 12px UI text never change with viewport.

The container is width-first (`calc(100% - 1rem)`), so gutters shrink before content reflows. The editor swaps its side rails for the mobile control set rather than compressing them. `prefers-reduced-motion: reduce` sets `animation: none !important` across every named animation; honor it on anything new.

---

## Agent Prompt Guide

When extending this UI, work in this order:

1. **Consume tokens, never literals.** Write `bg-card`, `text-muted-foreground`, `border-border`. A raw hex in a component is a bug. Alpha modifiers (`primary/80`, `foreground/60`) are the idiomatic way to derive.
2. **Start from `components/ui/`.** `Button`, `Card`, `Input` already encode the specs above. Extend via `className`, not by rewriting the variant list.
3. **Pick the density first.** Marketing surface → 96px rhythm, 36px+ headings. Editor surface → `h-7` controls, 12px text, `.label-eyebrow` section labels.
4. **Choose separation before decoration.** Ask "hairline, alpha, blur, or radius step?" Never "which shadow?"
5. **Use the two durations.** `150ms cubic-bezier(0.4, 0, 0.2, 1)` for interaction feedback, `500ms` same curve for reveals. Marquees run 64–72s linear.
6. **Check both themes.** Dark mode is not a filter — borders switch from a grey hex to alpha-white, and `--accent` inverts to a dark wash with a light foreground.
7. **Verify by measuring.** Read back computed styles rather than trusting the class string.

**Unknowns.** Narrow-viewport rendering was not measured directly. The `--rail` dash geometry (6px dash / 8px gap / 1px) is read from source, not computed output. Confirm Geist's current license terms independently before shipping the font files anywhere new.
