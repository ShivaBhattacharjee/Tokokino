import type { CSSProperties } from "react"

import {
  CodeBlock,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockHeader,
  CodeBlockItem,
} from "@/components/kibo-ui/code-block"
import {
  type CodeBlockLanguage,
  CodeBlockContent,
} from "@/components/kibo-ui/code-block/server"
import { cn } from "@/lib/utils"

const THEMES = { light: "github-light", dark: "github-dark-default" } as const

const THIN_SCROLLBAR = {
  "--scrollbar-size": "5px",
  "--scrollbar-track": "transparent",
  "--scrollbar-thumb":
    "color-mix(in oklab, var(--foreground) 18%, transparent)",
  "--scrollbar-thumb-hover":
    "color-mix(in oklab, var(--foreground) 32%, transparent)",
} as CSSProperties

export function CodeSample({
  code,
  filename,
  language = "bash",
  className,
}: {
  code: string
  filename: string
  language?: CodeBlockLanguage
  className?: string
}) {
  return (
    <CodeBlock
      data={[{ language, filename, code }]}
      defaultValue={language}
      className={cn("border-border/40", className)}
    >
      <CodeBlockHeader>
        <CodeBlockFilename className="grow" value={language}>
          {filename}
        </CodeBlockFilename>
        <CodeBlockCopyButton aria-label="Copy code" />
      </CodeBlockHeader>
      <CodeBlockItem
        value={language}
        lineNumbers={false}
        style={THIN_SCROLLBAR}
      >
        <CodeBlockContent language={language} themes={THEMES}>
          {code}
        </CodeBlockContent>
      </CodeBlockItem>
    </CodeBlock>
  )
}
