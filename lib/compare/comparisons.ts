export type ComparisonRow = {
  feature: string
  tokokino: string
  competitor: string
}

export type Comparison = {
  slug: string
  competitor: string
  /** Shown next to the link in "Other comparisons" lists. */
  summary: string
  /** Small line above the intro copy. */
  eyebrow: string
  metaTitle: string
  metaDescription: string
  intro: string[]
  rows: ComparisonRow[]
  pickTokokino: string[]
  pickCompetitor: string[]
}

/**
 * Plan details on competitor sites move around, so these pages describe what is
 * free vs paid rather than quoting prices. Bump this when the claims are
 * re-checked.
 */
export const COMPARISONS_CHECKED_AT = "July 2026"

export const COMPARISONS: Comparison[] = [
  {
    slug: "tokokino-vs-postspark",
    competitor: "PostSpark",
    summary: "Free local-first editor vs subscription screenshot studio",
    eyebrow: "Free local-first editor vs subscription screenshot studio",
    metaTitle: "Tokokino vs PostSpark — Screenshot & Mockup Editor Comparison",
    metaDescription:
      "How Tokokino and PostSpark compare on export quality, animation, templates, watermarks, and what each one charges for. A plain-language feature breakdown.",
    intro: [
      "PostSpark is the tool closest to Tokokino. Both take a raw screenshot and give you back something that looks designed: padding, backgrounds, device frames, social post mockups, and video. If you like one, you will recognise most of the other.",
      "The real difference is where each product draws the line between free and paid. PostSpark's free tier covers static screenshots well, but the things you reach for once you get serious — video mockups, animation and zoom, unlimited usage, cloud storage — sit behind PostSpark Pro.",
      "Tokokino keeps those in the free product. Editing happens in your browser rather than on a server, so a 100MB capture never has to upload, the editor keeps working with no connection, and you can export 4K or 8K stills and GIF/WebM/MP4 motion without a watermark or a subscription meter.",
    ],
    rows: [
      {
        feature: "Cost model",
        tokokino: "Free — no plan gate on export quality or motion",
        competitor: "Free tier plus PostSpark Pro subscription",
      },
      {
        feature: "Where editing happens",
        tokokino:
          "In your browser — captures stay on your machine unless you share",
        competitor: "Cloud-backed editor tied to your account",
      },
      {
        feature: "Watermark",
        tokokino: "None, on every export format",
        competitor: "Removed on the paid plan",
      },
      {
        feature: "Still export",
        tokokino: "PNG, JPEG, WebP at HD, 4K, and 8K widths",
        competitor: "High-resolution export on the paid plan",
      },
      {
        feature: "Animation",
        tokokino:
          "Editable keyframe timeline — tilt, zoom, shadow, background, filters",
        competitor: "Animation and zoom workflows on Pro",
      },
      {
        feature: "Video mockups",
        tokokino: "Drop a screen recording onto the canvas, free",
        competitor: "Pro feature",
      },
      {
        feature: "Motion export",
        tokokino: "GIF, WebM, and MP4, including on Safari",
        competitor: "Available on Pro",
      },
      {
        feature: "Templates",
        tokokino: "Starter image and animation templates, free",
        competitor: "Large public template library",
      },
      {
        feature: "Social post mockups",
        tokokino: "X and Bluesky, including quoted posts",
        competitor: "X and Bluesky supported",
      },
      {
        feature: "Saved projects",
        tokokino: "Free cloud drafts with a 1 GB pool",
        competitor: "Cloud storage on Pro",
      },
      {
        feature: "Custom presets",
        tokokino: "Unlimited saved layout and style presets",
        competitor: "Not publicly listed as a free feature",
      },
      {
        feature: "Very large screenshots",
        tokokino: "Built for 100MB+ captures — nothing gets uploaded first",
        competitor: "Practical limits tied to upload and plan",
      },
      {
        feature: "Source code",
        tokokino: "Open source (AGPL-3.0)",
        competitor: "Closed source",
      },
    ],
    pickTokokino: [
      "You want 4K/8K stills and animated demos without paying per month.",
      "You work with huge captures or screen recordings and don't want to wait on uploads.",
      "You want to keyframe a demo yourself instead of picking from fixed animation presets.",
      "You care that the editor keeps working offline and that the code is open.",
    ],
    pickCompetitor: [
      "You want the widest ready-made template library and are happy on a subscription.",
      "Your team already runs on PostSpark and shares assets through it.",
      "You prefer a fully cloud-managed workflow over local-first editing.",
    ],
  },
  {
    slug: "tokokino-vs-pika",
    competitor: "Pika",
    summary: "Motion-capable editor vs image-first mockup tool",
    eyebrow: "Motion-capable editor vs image-first mockup tool",
    metaTitle: "Tokokino vs Pika (pika.style) — Which Screenshot Editor to Use",
    metaDescription:
      "Tokokino and Pika both make polished screenshot mockups in the browser. Here's how they differ on animation, 4K export, presets, annotations, and pricing.",
    intro: [
      "Pika (pika.style) is a well-made browser editor for still visuals. It captures a page from a URL, turns tweets into shots, and drops your screenshot into dozens of device and browser mockups. For one-off images it's fast and it looks good.",
      "Where the two tools separate is motion. Pika stays image-first — there is no keyframe timeline and no GIF or WebM product demo. If your launch needs a short clip showing the product actually being used, that's a different tool.",
      "Tokokino covers both halves of a launch: the still shot and the ten-second demo. It also puts things Pika reserves for Pro — 4K export, saved presets, annotation tools, WebP export, and going watermark-free — in the free product, and adds Bluesky post mockups on top.",
    ],
    rows: [
      {
        feature: "Cost model",
        tokokino: "Free, with no paid tier gating exports",
        competitor: "Free tier plus Pika Pro subscription",
      },
      {
        feature: "Watermark",
        tokokino: "None",
        competitor: "Removed on Pro",
      },
      {
        feature: "Still export",
        tokokino: "PNG, JPEG, WebP at HD, 4K, and 8K",
        competitor: "4K and WebP/SVG on Pro",
      },
      {
        feature: "Animation",
        tokokino: "Full keyframe timeline for product motion",
        competitor: "Not offered — image-first editor",
      },
      {
        feature: "Motion export",
        tokokino: "GIF, WebM, MP4",
        competitor: "Not offered",
      },
      {
        feature: "Video on the canvas",
        tokokino: "Drop a screen recording, crop, mute, and scrub it",
        competitor: "Not offered",
      },
      {
        feature: "Templates",
        tokokino: "Starter stills plus animated reveals, free",
        competitor: "Large mockup library, some templates on Pro",
      },
      {
        feature: "Annotations",
        tokokino: "Arrows, shapes, and freehand on their own layer, free",
        competitor: "Annotation tools on Pro",
      },
      {
        feature: "Custom presets",
        tokokino: "Unlimited saved presets, free",
        competitor: "Presets on Pro",
      },
      {
        feature: "Social post mockups",
        tokokino: "X and Bluesky, plus quoted posts",
        competitor: "X (Twitter) supported",
      },
      {
        feature: "Capture a page from a URL",
        tokokino: "Yes",
        competitor: "Yes — a core Pika feature",
      },
      {
        feature: "Saved projects",
        tokokino: "Free cloud drafts with a 1 GB pool",
        competitor: "Not publicly listed as a free feature",
      },
      {
        feature: "Source code",
        tokokino: "Open source (AGPL-3.0)",
        competitor: "Open source",
      },
    ],
    pickTokokino: [
      "Your launch needs a moving demo, not just a still screenshot.",
      "You want 4K/8K stills, annotations, and saved presets without upgrading.",
      "You post to Bluesky as well as X.",
      "You want a canvas that accepts video and GIF, not only images.",
    ],
    pickCompetitor: [
      "You only ever need still images and like Pika's mockup library.",
      "URL-to-screenshot capture is the main thing you do all day.",
    ],
  },
  {
    slug: "tokokino-vs-shots-so",
    competitor: "Shots.so",
    summary: "Editable keyframe timeline vs preset-driven animation",
    eyebrow: "Editable keyframe timeline vs preset-driven animation",
    metaTitle: "Tokokino vs Shots.so — Device Mockups and Animated Demos",
    metaDescription:
      "Shots.so is strong on device frames and magic backgrounds. See how Tokokino compares on animation control, export limits, social mockups, and cost.",
    intro: [
      "Shots.so is one of the nicest device-frame tools around. The frames are clean, the magic backgrounds do a lot of work for you, and the animated mockup presets look sharp with almost no effort. If you want a good-looking result in thirty seconds, it delivers.",
      "The trade-off is control and cost. Shots.so animates through presets rather than a timeline you can edit, serious motion export sits on the paid tiers, and there are no social post mockups.",
      "Tokokino goes the other way: the same device and browser frames and multi-shot layouts, but with a keyframe timeline underneath so you decide what moves, when, and how far — then export it as GIF, WebM, or MP4 for free.",
    ],
    rows: [
      {
        feature: "Cost model",
        tokokino: "Free, including motion export",
        competitor: "Free tier plus paid tiers for motion and higher export",
      },
      {
        feature: "Device frames",
        tokokino: "Phone, tablet, laptop, desktop, watch, and browser chrome",
        competitor: "Extensive, high-quality frame library",
      },
      {
        feature: "Backgrounds",
        tokokino: "Gradients, images, overlays, and auto-sampled palettes",
        competitor: "Magic backgrounds generated from your shot",
      },
      {
        feature: "Animation model",
        tokokino:
          "Editable keyframe timeline across tilt, zoom, shadow, background, filters",
        competitor: "Animation presets and video zoom",
      },
      {
        feature: "Motion export",
        tokokino: "GIF, WebM, MP4 — free",
        competitor: "WebM and animated mockups on paid tiers",
      },
      {
        feature: "Still export",
        tokokino: "HD, 4K, and 8K, no watermark",
        competitor: "Higher resolutions on paid tiers",
      },
      {
        feature: "Video mockups",
        tokokino: "Drop a screen recording onto the canvas, free",
        competitor: "Paid feature",
      },
      {
        feature: "Social post mockups",
        tokokino: "X and Bluesky, including quoted posts",
        competitor: "Not offered",
      },
      {
        feature: "Multi-shot layouts",
        tokokino: "Up to three extra shots per canvas with layout presets",
        competitor: "Supported",
      },
      {
        feature: "Bulk editing",
        tokokino: "Style and arrange several canvases on one board",
        competitor: "Not offered",
      },
      {
        feature: "Where editing happens",
        tokokino: "In your browser — works with no connection",
        competitor: "Cloud-backed",
      },
      {
        feature: "Source code",
        tokokino: "Open source (AGPL-3.0)",
        competitor: "Closed source",
      },
    ],
    pickTokokino: [
      "You want to control the motion frame by frame instead of accepting a preset.",
      "You need GIF/WebM/MP4 demos without moving to a paid tier.",
      "You post product shots to X or Bluesky and want the post mockup too.",
      "You're preparing a set of screenshots at once and want to style them side by side.",
    ],
    pickCompetitor: [
      "You want the fastest possible path to one polished device mockup.",
      "Magic backgrounds and the frame library are the whole reason you're there.",
    ],
  },
  {
    slug: "tokokino-vs-canva",
    competitor: "Canva",
    summary: "Purpose-built screenshot tool vs general design suite",
    eyebrow: "Purpose-built screenshot tool vs general design suite",
    metaTitle: "Tokokino vs Canva — Screenshot Mockups Without a Design Suite",
    metaDescription:
      "Canva can style a screenshot, but you build the look by hand every time. Compare Tokokino and Canva on device frames, animation, export, and effort per shot.",
    intro: [
      "Canva is a general design suite. Decks, posters, social graphics, print, video — it does all of it, with a huge template library and a team behind it. It is genuinely good at that job.",
      "Styling a screenshot in Canva means doing the work yourself: place the image, draw a rounded rectangle behind it, add a shadow, nudge the padding, and repeat that for every shot. There is no device frame that knows what an iPhone bezel looks like, no shadow that follows the tilt of your screenshot, and no way to point Canva at a screen recording and get a product demo out.",
      "Tokokino does one job. Drop a capture in and the padding, background, frame, shadow, and tilt are already there as controls built for screenshots — plus a timeline for turning that shot into a short demo clip. If you need a birthday card, use Canva. If you need twenty product screenshots that all look like they came from the same place, this is faster.",
    ],
    rows: [
      {
        feature: "What it's built for",
        tokokino: "Screenshots, product mockups, and short demo clips",
        competitor: "General design — decks, social, print, video",
      },
      {
        feature: "Cost model",
        tokokino: "Free — no plan gate on export or motion",
        competitor: "Free tier plus Canva Pro and Teams subscriptions",
      },
      {
        feature: "Effort per screenshot",
        tokokino:
          "Drop it in — padding, background, and shadow are already set",
        competitor: "Compose the frame, shadow, and background by hand",
      },
      {
        feature: "Device frames",
        tokokino: "Pixel-true phone, tablet, laptop, watch, and browser chrome",
        competitor: "Static mockup graphics you place your image into",
      },
      {
        feature: "3D tilt and depth",
        tokokino:
          "Tilt on three axes with shadows that follow the light source",
        competitor: "Flat rotation only",
      },
      {
        feature: "Backgrounds",
        tokokino: "Auto-sampled palettes drawn from your screenshot",
        competitor: "Manual colour, gradient, or stock image",
      },
      {
        feature: "Animation",
        tokokino:
          "Keyframe timeline built for product motion — zoom, tilt, reveals",
        competitor: "General-purpose video timeline and slide animations",
      },
      {
        feature: "Motion export",
        tokokino: "GIF, WebM, MP4",
        competitor: "MP4 and GIF, some options on paid plans",
      },
      {
        feature: "Still export",
        tokokino: "PNG, JPEG, WebP at HD, 4K, and 8K, no watermark",
        competitor: "PNG/JPEG/PDF; transparent PNG on Pro",
      },
      {
        feature: "Social post mockups",
        tokokino: "Paste an X or Bluesky link, get an exportable card",
        competitor: "Not offered — build it as a graphic",
      },
      {
        feature: "Where editing happens",
        tokokino: "In your browser — works with no connection",
        competitor: "Cloud-based, account required",
      },
      {
        feature: "Very large screenshots",
        tokokino: "100MB+ captures stay local, so nothing uploads first",
        competitor: "Upload limits tied to your plan",
      },
      {
        feature: "Source code",
        tokokino: "Open source (AGPL-3.0)",
        competitor: "Closed source",
      },
    ],
    pickTokokino: [
      "Screenshots are most of what you make, and you make a lot of them.",
      "You want device frames, realistic shadows, and 3D tilt without building them yourself.",
      "You need the same shot as both a still and a short demo clip.",
      "You don't want to sign in or upload a capture just to style it.",
    ],
    pickCompetitor: [
      "You need one tool for decks, print, social graphics, and brand assets.",
      "Your team already collaborates in Canva and shares a brand kit there.",
      "You want a template for something that isn't a screenshot.",
    ],
  },
]

export function getComparison(slug: string) {
  return COMPARISONS.find((entry) => entry.slug === slug)
}

export function otherComparisons(slug: string) {
  return COMPARISONS.filter((entry) => entry.slug !== slug)
}
