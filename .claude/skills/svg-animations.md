---
name: svg-animations
description: Create beautiful, performant SVG animations and illustrations. Use this skill when the user asks to create SVG graphics, icons, illustrations, animated logos, path animations, morphing shapes, loading spinners, or any animated SVG content. Covers SMIL animations, CSS-driven SVG animation, path drawing effects, shape morphing, motion paths, gradients, masks, and filters.
---

This skill guides creation of handcrafted SVG animations — from simple animated icons to complex multi-stage path animations. SVGs are a markup language for images; every element is a DOM node you can style, animate, and script.

## SVG Fundamentals

### Coordinate System
SVGs use a coordinate system defined by `viewBox="minX minY width height"`. The viewBox is your canvas — all coordinates are relative to it, making SVGs resolution-independent.

```svg
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- 200x200 unit canvas, scales to any size -->
</svg>
```

### Shape Primitives

```svg
<rect x="10" y="10" width="80" height="40" rx="4" fill="#1a1a1a" />
<circle cx="50" cy="50" r="30" fill="#e63946" />
<ellipse cx="50" cy="50" rx="40" ry="20" fill="#457b9d" />
<line x1="10" y1="10" x2="90" y2="90" stroke="#2a9d8f" stroke-width="2" />
<polygon points="50,5 95,90 5,90" fill="#e9c46a" />
<polyline points="10,80 40,20 70,60 100,10" fill="none" stroke="#264653" stroke-width="2" />
```

### The `<path>` Element — The Power Tool

The `d` attribute defines a path using commands. Uppercase = absolute, lowercase = relative.

| Command | Purpose | Syntax |
|---------|---------|--------|
| M/m | Move to | `M x y` |
| L/l | Line to | `L x y` |
| H/h | Horizontal line | `H x` |
| V/v | Vertical line | `V y` |
| C/c | Cubic bézier | `C x1 y1, x2 y2, x y` |
| S/s | Smooth cubic bézier | `S x2 y2, x y` |
| Q/q | Quadratic bézier | `Q x1 y1, x y` |
| T/t | Smooth quadratic | `T x y` |
| A/a | Elliptical arc | `A rx ry rotation large-arc sweep x y` |
| Z/z | Close path | `Z` |

**Cubic Bézier** (`C`): Two control points define the curve. The first control point sets the departure angle, the second sets the arrival angle.

```svg
<path d="M 10 80 C 40 10, 65 10, 95 80" stroke="#000" fill="none" stroke-width="2" />
```

**Smooth Cubic** (`S`): Reflects the previous control point automatically — perfect for chaining fluid S-curves.

```svg
<path d="M 10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80" stroke="#000" fill="none" />
```

**Arc** (`A`): `rx ry x-rotation large-arc-flag sweep-flag x y`
- `large-arc-flag`: 0 = small arc, 1 = large arc (>180°)
- `sweep-flag`: 0 = counterclockwise, 1 = clockwise

```svg
<!-- Heart shape using arcs and quadratic curves -->
<path d="M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 Z"
      fill="#e63946" />
```

### Grouping and Transforms

```svg
<g transform="translate(50, 50) rotate(45)" opacity="0.8">
  <rect x="-20" y="-20" width="40" height="40" fill="#264653" />
</g>
```

Use `<g>` to group elements for collective transforms, styling, and animation targets.

### Gradients, Masks, and Filters

```svg
<defs>
  <!-- Linear gradient -->
  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#e63946" />
    <stop offset="100%" stop-color="#457b9d" />
  </linearGradient>

  <!-- Radial gradient -->
  <radialGradient id="glow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#fff" stop-opacity="0.8" />
    <stop offset="100%" stop-color="#fff" stop-opacity="0" />
  </radialGradient>

  <!-- Mask -->
  <mask id="reveal">
    <rect width="100%" height="100%" fill="black" />
    <circle cx="100" cy="100" r="50" fill="white" />
  </mask>

  <!-- Blur filter -->
  <filter id="blur">
    <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
  </filter>
</defs>

<rect width="200" height="200" fill="url(#grad)" />
<rect width="200" height="200" fill="url(#grad)" mask="url(#reveal)" />
<circle cx="50" cy="50" r="20" filter="url(#blur)" fill="#e63946" />
```

---

## CSS Animations on SVG

Many SVG attributes are valid CSS properties: `fill`, `stroke`, `opacity`, `transform`, `stroke-dasharray`, `stroke-dashoffset`, etc.

### Basic CSS Animation

```css
.pulse {
  animation: pulse 2s ease-in-out infinite;
  transform-origin: center;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.15); opacity: 0.7; }
}
```

### Stroke Drawing Animation (The Classic)

The most iconic SVG animation. Uses `stroke-dasharray` and `stroke-dashoffset` to make a path appear to draw itself.

**How it works:**
1. Set `stroke-dasharray` to the path's total length (one giant dash + one giant gap)
2. Set `stroke-dashoffset` to the same length (shifts the dash off-screen)
3. Animate `stroke-dashoffset` to 0 (slides the dash into view)

```svg
<svg viewBox="0 0 200 200">
  <path class="draw" d="M 20 100 C 20 50, 80 50, 80 100 S 140 150, 140 100"
        fill="none" stroke="#1a1a1a" stroke-width="3" />
</svg>

<style>
  .draw {
    stroke-dasharray: 300;
    stroke-dashoffset: 300;
    animation: draw 2s ease forwards;
  }
  @keyframes draw {
    to { stroke-dashoffset: 0; }
  }
</style>
```

**Getting exact path length in JS:**
```js
const path = document.querySelector('.draw');
const length = path.getTotalLength();
path.style.strokeDasharray = length;
path.style.strokeDashoffset = length;
```

### Staggered Multi-Path Drawing

```css
.line-1 { animation-delay: 0s; }
.line-2 { animation-delay: 0.3s; }
.line-3 { animation-delay: 0.6s; }
```

### CSS `d` Property Animation

Modern browsers support animating the `d` attribute directly in CSS:

```css
path {
  d: path("M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 z");
  transition: d 0.5s ease;
}
path:hover {
  d: path("M 10,50 A 20,20 0,0,1 50,10 A 20,20 0,0,1 90,50 Q 90,80 50,100 Q 10,80 10,50 z");
}
```

**Requirement:** Both paths must have the same number and types of commands for interpolation to work.

---

## SMIL Animations (Native SVG)

SMIL animations are declared directly inside SVG markup. They work even when SVG is loaded as an `<img>` or CSS `background-image` — where CSS and JS can't reach.

### `<animate>` — Animate Any Attribute

```svg
<circle cx="50" cy="50" r="20" fill="#e63946">
  <animate attributeName="r" from="20" to="40" dur="1s"
           repeatCount="indefinite" />
</circle>
```

With keyframes:
```svg
<animate attributeName="cx"
         values="50; 150; 100; 50"
         keyTimes="0; 0.33; 0.66; 1"
         dur="3s" repeatCount="indefinite" />
```

### `<animateTransform>` — Transform Animations

```svg
<rect x="-20" y="-20" width="40" height="40" fill="#264653">
  <animateTransform attributeName="transform" type="rotate"
                    from="0" to="360" dur="4s" repeatCount="indefinite" />
</rect>
```

Types: `translate`, `scale`, `rotate`, `skewX`, `skewY`

### `<animateMotion>` — Move Along a Path

```svg
<circle r="5" fill="#e63946">
  <animateMotion dur="3s" repeatCount="indefinite" rotate="auto">
    <mpath href="#motionPath" />
  </animateMotion>
</circle>
<path id="motionPath" d="M 20,50 C 20,0 80,0 80,50 S 140,100 140,50"
      fill="none" stroke="#ccc" />
```

`rotate="auto"` orients the element tangent to the path. `rotate="auto-reverse"` flips it 180°.

### `<set>` — Discrete Value Changes

```svg
<rect width="40" height="40" fill="#264653">
  <set attributeName="fill" to="#e63946" begin="1s" />
</rect>
```

### Timing and Synchronization

```svg
<!-- Chain animations by referencing IDs -->
<animate id="first" attributeName="cx" to="150" dur="1s" fill="freeze" />
<animate attributeName="cy" to="150" dur="1s" begin="first.end" fill="freeze" />
<animate attributeName="r" to="30" dur="0.5s" begin="first.end + 0.5s" fill="freeze" />
```

Trigger values:
- `begin="click"` — on click
- `begin="2s"` — after 2 seconds
- `begin="other.end"` — when another animation ends
- `begin="other.end + 1s"` — 1s after another ends
- `begin="other.repeat(2)"` — on 2nd repeat of another

### Easing with `calcMode` and `keySplines`

```svg
<animate attributeName="cx" values="50;150" dur="1s"
         calcMode="spline" keySplines="0.42 0 0.58 1" />
```

`calcMode` options: `linear` (default), `discrete`, `paced`, `spline`

`keySplines` takes cubic-bezier control points (x1 y1 x2 y2) per interval. Common easings:
- Ease-in-out: `0.42 0 0.58 1`
- Ease-out: `0 0 0.58 1`
- Bounce-ish: `0.34 1.56 0.64 1`

### Shape Morphing with SMIL

Both shapes must have identical command structures (same number of points, same command types):

```svg
<path fill="#e63946">
  <animate attributeName="d" dur="2s" repeatCount="indefinite"
    values="M 50,10 L 90,90 L 10,90 Z;
            M 50,90 L 90,10 L 10,10 Z;
            M 50,10 L 90,90 L 10,90 Z" />
</path>
```

---

## Animation Patterns & Recipes

### Loading Spinner

```svg
<svg viewBox="0 0 50 50">
  <circle cx="25" cy="25" r="20" fill="none" stroke="#1a1a1a"
          stroke-width="3" stroke-linecap="round"
          stroke-dasharray="90 150" stroke-dashoffset="0">
    <animateTransform attributeName="transform" type="rotate"
                      from="0 25 25" to="360 25 25" dur="1s"
                      repeatCount="indefinite" />
    <animate attributeName="stroke-dashoffset" values="0;-280"
             dur="1.5s" repeatCount="indefinite" />
  </circle>
</svg>
```

### Animated Checkmark

```svg
<svg viewBox="0 0 52 52">
  <circle cx="26" cy="26" r="24" fill="none" stroke="#4caf50"
          stroke-width="2" class="draw"
          style="stroke-dasharray:150;stroke-dashoffset:150;
                 animation:draw .6s ease forwards" />
  <path fill="none" stroke="#4caf50" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"
        d="M14 27l7 7 16-16" class="draw"
        style="stroke-dasharray:50;stroke-dashoffset:50;
               animation:draw .4s ease .5s forwards" />
</svg>
```

### Morphing Hamburger to X

```svg
<svg viewBox="0 0 24 24" id="menu">
  <path id="top" d="M 3,6 L 21,6" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round">
    <animate attributeName="d" to="M 5,5 L 19,19" dur="0.3s" begin="menu.click" fill="freeze" />
  </path>
  <path id="mid" d="M 3,12 L 21,12" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round">
    <animate attributeName="opacity" to="0" dur="0.1s" begin="menu.click" fill="freeze" />
  </path>
  <path id="bot" d="M 3,18 L 21,18" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round">
    <animate attributeName="d" to="M 5,19 L 19,5" dur="0.3s" begin="menu.click" fill="freeze" />
  </path>
</svg>
```

### Gradient Animation (Color Shift)

```svg
<defs>
  <linearGradient id="shift" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%">
      <animate attributeName="stop-color"
               values="#e63946;#457b9d;#2a9d8f;#e63946"
               dur="4s" repeatCount="indefinite" />
    </stop>
    <stop offset="100%">
      <animate attributeName="stop-color"
               values="#457b9d;#2a9d8f;#e63946;#457b9d"
               dur="4s" repeatCount="indefinite" />
    </stop>
  </linearGradient>
</defs>
<rect width="200" height="100" fill="url(#shift)" rx="8" />
```

### Breathing / Pulsing Glow

```svg
<circle cx="100" cy="100" r="30" fill="#e63946">
  <animate attributeName="r" values="30;35;30" dur="2s"
           calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
           repeatCount="indefinite" />
  <animate attributeName="opacity" values="1;0.6;1" dur="2s"
           calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
           repeatCount="indefinite" />
</circle>
```

### Wave / Liquid Effect

```svg
<path fill="#457b9d" opacity="0.7">
  <animate attributeName="d" dur="5s" repeatCount="indefinite"
    values="M 0,40 C 30,35 70,45 100,40 L 100,100 L 0,100 Z;
            M 0,40 C 30,50 70,30 100,40 L 100,100 L 0,100 Z;
            M 0,40 C 30,35 70,45 100,40 L 100,100 L 0,100 Z"
    calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
</path>
```

---

## Best Practices

1. **Use `viewBox`, never hardcode `width`/`height` in the SVG** — let the container size it. This keeps it resolution-independent.

2. **`<defs>` for reusable definitions** — gradients, filters, masks, clipPaths, and reusable shapes belong in `<defs>`.

3. **Prefer SMIL for self-contained SVGs** (icons, logos loaded via `<img>`) — CSS/JS won't work there. Use CSS animations when the SVG is inlined and you want to coordinate with the rest of the page.

4. **Shape morphing requires matching commands** — same number of path commands, same types, same order. If shapes differ, add invisible intermediate points to equalize.

5. **`stroke-linecap="round"`** makes line animations look polished.

6. **`fill="freeze"`** in SMIL keeps the final animation state. Without it, the element snaps back.

7. **`transform-origin: center`** in CSS — SVG transforms default to the origin (0,0), not the element center. Always set this explicitly.

8. **Use `getTotalLength()`** in JS to get exact path lengths for stroke animations instead of guessing.

9. **Layer animations with `<g>` groups** — animate the group transform separately from individual element properties for complex choreography.

10. **Performance:** SVG animations are GPU-composited when animating `transform` and `opacity`. Animating `d`, `points`, or layout attributes triggers repaints — use sparingly on complex SVGs.

11. **`will-change: transform`** on animated SVG elements helps the browser optimize compositing.

12. **Accessibility:** Add `role="img"` and `<title>` / `<desc>` elements. Use `prefers-reduced-motion` media query to disable animations for users who request it:

```css
@media (prefers-reduced-motion: reduce) {
  svg * {
    animation: none !important;
    transition: none !important;
  }
}
```