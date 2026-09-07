function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function inlineMd(value: string) {
  let out = escapeHtml(value)

  out = out.replaceAll(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="underline decoration-primary/30 underline-offset-4 hover:text-primary hover:decoration-primary">$1</a>'
  )

  out = out.replaceAll(
    /`([^`]+)`/g,
    '<code class="rounded bg-foreground/[0.07] px-1 py-0.5 font-mono text-[12.5px] text-foreground ring-1 ring-border/50">$1</code>'
  )

  out = out.replaceAll(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-semibold text-foreground">$1</strong>'
  )

  out = out.replaceAll(
    /\*([^*]+)\*/g,
    '<em class="italic text-foreground/90">$1</em>'
  )

  return out
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replaceAll("\r\n", "\n").split("\n")
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed === "---") {
      blocks.push('<hr class="my-8 border-border/60" />')
      i += 1
      continue
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/)
    if (imageMatch) {
      blocks.push(
        `<figure class="my-8 overflow-hidden rounded-lg border border-border/60"><img src="${imageMatch[2]}" alt="${escapeHtml(imageMatch[1])}" loading="lazy" class="w-full" /></figure>`
      )
      i += 1
      continue
    }

    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""))
        i += 1
      }
      const inner = inlineMd(quoteLines.join(" "))
      blocks.push(
        `<blockquote class="my-6 border-l-2 border-primary/50 bg-primary/[0.04] px-4 py-3 text-sm leading-7 text-foreground/70">${inner}</blockquote>`
      )
      continue
    }

    if (trimmed.startsWith("### ")) {
      const text = trimmed.slice(4).trim()
      i += 1
      // A `###` plus its following paragraphs renders as one bulleted item:
      // dot + bold title, body text tucked underneath.
      const paras: string[] = []
      for (;;) {
        while (i < lines.length && !lines[i].trim()) i += 1
        if (i >= lines.length) break
        const next = lines[i].trim()
        if (
          next.startsWith("#") ||
          next.startsWith(">") ||
          next.startsWith("- ") ||
          next.startsWith("* ") ||
          /^\d+\.\s/.test(next) ||
          next === "---"
        ) {
          break
        }
        const para: string[] = []
        while (
          i < lines.length &&
          lines[i].trim() &&
          !lines[i].trim().startsWith("#") &&
          !lines[i].trim().startsWith(">") &&
          !lines[i].trim().startsWith("- ") &&
          !lines[i].trim().startsWith("* ") &&
          !/^\d+\.\s/.test(lines[i].trim()) &&
          lines[i].trim() !== "---"
        ) {
          para.push(lines[i].trim())
          i += 1
        }
        if (para.length) paras.push(para.join(" "))
      }
      const body = paras
        .map(
          (para) =>
            `<p class="mt-1.5 text-sm leading-7 text-foreground/70 sm:text-[15px] sm:leading-7">${inlineMd(para)}</p>`
        )
        .join("")
      blocks.push(
        `<div class="my-5 flex gap-2.5"><span class="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-primary"></span><div class="min-w-0"><div id="${slugify(text)}" class="scroll-mt-20 text-[15px] font-semibold tracking-tight text-foreground">${inlineMd(text)}</div>${body}</div></div>`
      )
      continue
    }

    if (trimmed.startsWith("## ")) {
      const text = trimmed.slice(3).trim()
      const id = slugify(text)
      blocks.push(
        `<h2 id="${id}" class="group mt-10 scroll-mt-20 text-2xl font-medium leading-[1.25] tracking-tight text-foreground sm:text-[28px]"><a href="#${id}" data-section-link aria-label="Copy link to this section" class="mr-2 inline-flex size-[0.85em] items-center justify-center rounded align-baseline text-foreground/35 transition-colors hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[0.65em]" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></a>${inlineMd(text)}</h2>`
      )
      i += 1
      continue
    }

    if (trimmed.startsWith("# ")) {
      const text = trimmed.slice(2).trim()
      blocks.push(
        `<h1 id="${slugify(text)}" class="mt-2 scroll-mt-20 text-2xl font-medium tracking-tight text-foreground sm:text-3xl">${inlineMd(text)}</h1>`
      )
      i += 1
      continue
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items: string[] = []
      while (
        i < lines.length &&
        (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))
      ) {
        items.push(lines[i].trim().slice(2))
        i += 1
      }
      if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]")) {
        const checks = items
          .map((item) => {
            const isCheck = item.startsWith("[x]") || item.startsWith("[ ]")
            const checked = item.startsWith("[x]")
            const label = isCheck ? item.slice(3).trim() : item
            return `<li class="flex gap-2.5"><span class="mt-1.5 size-3.5 shrink-0 rounded border ${checked ? "bg-primary border-primary" : "border-border"} flex items-center justify-center">${checked ? '<span class="text-[9px] text-primary-foreground">✓</span>' : ""}</span><span>${inlineMd(label)}</span></li>`
          })
          .join("")
        blocks.push(
          `<ul class="my-5 space-y-2 text-sm leading-7 text-foreground/70">${checks}</ul>`
        )
      } else {
        const lis = items
          .map(
            (item) =>
              `<li class="flex gap-2.5"><span class="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-primary"></span><span>${inlineMd(item)}</span></li>`
          )
          .join("")
        blocks.push(
          `<ul class="my-5 space-y-2 text-sm leading-7 text-foreground/70">${lis}</ul>`
        )
      }
      continue
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ""))
        i += 1
      }
      const lis = items
        .map(
          (item, idx) =>
            `<li class="flex gap-3"><span class="font-mono text-xs text-primary/70 mt-0.5">${idx + 1}.</span><span>${inlineMd(item)}</span></li>`
        )
        .join("")
      blocks.push(
        `<ol class="my-5 space-y-2 text-sm leading-7 text-foreground/70">${lis}</ol>`
      )
      continue
    }

    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].trim().startsWith("- ") &&
      !lines[i].trim().startsWith("* ") &&
      !/^\d+\.\s/.test(lines[i].trim()) &&
      lines[i].trim() !== "---"
    ) {
      para.push(lines[i].trim())
      i += 1
    }
    const text = para.join(" ")
    if (text) {
      blocks.push(
        `<p class="my-5 text-sm leading-7 text-foreground/70 sm:text-[15px] sm:leading-7">${inlineMd(text)}</p>`
      )
    }
  }

  return (
    <div
      className="min-w-0"
      dangerouslySetInnerHTML={{ __html: blocks.join("\n") }}
    />
  )
}
