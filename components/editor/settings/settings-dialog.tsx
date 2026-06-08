"use client"

import * as React from "react"
import {
  RiCloseLine,
  RiComputerLine,
  RiEyeLine,
  RiLoader4Line,
  RiMoonLine,
  RiPaletteLine,
  RiResetLeftLine,
  RiSaveLine,
  RiSunLine,
  RiFunctionLine,
  RiImageLine,
  RiKeyboardLine,
} from "@remixicon/react"
import { LayoutGroup, motion } from "motion/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import {
  applyExportFilenameFormat,
  DEFAULT_EXPORT_FILENAME_FORMAT,
  EXPORT_FILENAME_VARIABLES,
  exportTimestamp,
  getExportFilenameFormat,
  randomFilenameToken,
  setExportFilenameFormat,
} from "@/lib/editor/export-filename"
import {
  formatShortcutKey,
  isApplePlatform,
  SHORTCUT_GROUPS,
} from "@/lib/editor/shortcuts"

type SettingsSection = "appearance" | "export" | "shortcuts"

const NAV_ITEMS: {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "appearance", label: "Appearance", icon: RiPaletteLine },
  { id: "export", label: "Export", icon: RiImageLine },
  { id: "shortcuts", label: "Shortcuts", icon: RiKeyboardLine },
]

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [section, setSection] = React.useState<SettingsSection>("appearance")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[560px] max-h-[85vh] gap-0 overflow-hidden rounded-md p-0 sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Configure appearance, export format, and view keyboard shortcuts.
        </DialogDescription>

        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close settings"
            className="absolute top-3 right-3 z-20 cursor-pointer rounded-sm bg-foreground/8 text-foreground/60 ring-1 ring-border/50 backdrop-blur-sm hover:bg-foreground/12 hover:text-foreground"
          >
            <RiCloseLine />
          </Button>
        </DialogClose>

        <div className="flex h-full min-h-0">
          {/* Sidebar */}
          <nav className="flex w-44 shrink-0 flex-col gap-1 border-r border-border/60 bg-secondary/30 p-3">
            <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Settings
            </p>
            <LayoutGroup id="settings-nav">
              {NAV_ITEMS.map((item) => {
                const active = section === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                      active
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {active ? (
                      <motion.span
                        layoutId="settings-nav-pill"
                        className="absolute inset-0 rounded-md bg-primary shadow-sm"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 34,
                        }}
                      />
                    ) : null}
                    <item.icon className="relative z-10 size-4" />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                )
              })}
            </LayoutGroup>
          </nav>

          {/* Content */}
          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {section === "appearance" && <AppearanceSection />}
            {section === "export" && <ExportSection />}
            {section === "shortcuts" && <ShortcutsSection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* Appearance                                                                 */
/* -------------------------------------------------------------------------- */

const THEME_OPTIONS: {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: "light", label: "Light", icon: RiSunLine },
  { value: "dark", label: "Dark", icon: RiMoonLine },
  { value: "system", label: "System", icon: RiComputerLine },
]

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), [])
  const active = mounted ? (theme ?? "system") : "system"

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Appearance"
        description="Choose how Tokokino looks on this device."
      />

      <div className="space-y-2">
        <p className="text-[13px] font-medium text-foreground">Theme</p>
        <LayoutGroup id="settings-theme">
          <div className="flex w-full max-w-sm items-center gap-1 rounded-xl bg-secondary/50 p-1">
            {THEME_OPTIONS.map((opt) => {
              const isActive = active === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
                    isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="settings-theme-pill"
                      className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  ) : null}
                  <opt.icon className="relative z-10 size-4" />
                  <span className="relative z-10">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </LayoutGroup>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

const PREVIEW_SAMPLE = {
  template: "default",
  scale: "hd",
  width: 1920,
  height: 1080,
}

function ExportSection() {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? null

  const [format, setFormat] = React.useState(DEFAULT_EXPORT_FILENAME_FORMAT)
  const [savedFormat, setSavedFormat] = React.useState(
    DEFAULT_EXPORT_FILENAME_FORMAT
  )
  const [saveState, setSaveState] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle")
  const [sampleRandom] = React.useState(() => randomFilenameToken())
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Signed-in users get their preference from the account (D1); signed-out
  // users fall back to the locally cached IndexedDB copy.
  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (userId) {
        try {
          const res = await fetch("/api/preferences", {
            credentials: "include",
          })
          const body: { exportFilenameFormat: string | null } | null = res.ok
            ? await res.json()
            : null
          const remote = body?.exportFilenameFormat
          if (!cancelled) {
            const next =
              remote && remote.trim() ? remote : DEFAULT_EXPORT_FILENAME_FORMAT
            setFormat(next)
            setSavedFormat(next)
          }
          return
        } catch {
          /* fall through to the local cache */
        }
      }

      const local = await getExportFilenameFormat()
      if (!cancelled) {
        setFormat(local)
        setSavedFormat(local)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [userId])

  const isDirty = format !== savedFormat

  const handleChange = React.useCallback((next: string) => {
    setFormat(next)
    setSaveState("idle")
  }, [])

  const insertToken = React.useCallback(
    (token: string) => {
      const input = inputRef.current
      const start = input?.selectionStart ?? format.length
      const end = input?.selectionEnd ?? format.length
      const next = format.slice(0, start) + token + format.slice(end)
      handleChange(next)
      requestAnimationFrame(() => {
        if (!input) return
        input.focus()
        const caret = start + token.length
        input.setSelectionRange(caret, caret)
      })
    },
    [format, handleChange]
  )

  const handleSave = React.useCallback(async () => {
    const next = format.trim() || DEFAULT_EXPORT_FILENAME_FORMAT
    setSaveState("saving")

    if (userId) {
      try {
        const res = await fetch("/api/preferences", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exportFilenameFormat: next }),
        })
        if (!res.ok) throw new Error("Request failed")
      } catch {
        setSaveState("error")
        toast.error("Couldn't save export preference")
        return
      }
    } else {
      await setExportFilenameFormat(next)
    }

    setFormat(next)
    setSavedFormat(next)
    setSaveState("saved")
  }, [format, userId])

  const preview =
    applyExportFilenameFormat(format, {
      date: exportTimestamp(),
      template: PREVIEW_SAMPLE.template,
      scale: PREVIEW_SAMPLE.scale,
      random: sampleRandom,
      width: PREVIEW_SAMPLE.width,
      height: PREVIEW_SAMPLE.height,
    }) + ".png"

  const isDefault = format === DEFAULT_EXPORT_FILENAME_FORMAT

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Export"
        description="Control how exported files are named."
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-foreground">
            Export filename format
          </p>
          <button
            type="button"
            onClick={() => handleChange(DEFAULT_EXPORT_FILENAME_FORMAT)}
            disabled={isDefault}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
            title="Reset to default"
          >
            <RiResetLeftLine className="size-3.5" />
            Reset
          </button>
        </div>

        <input
          ref={inputRef}
          value={format}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          className="w-full rounded-md border border-border/60 bg-secondary/40 px-3.5 py-2.5 font-mono text-[13px] text-foreground transition-colors outline-none focus:border-foreground/30 focus:bg-secondary/60"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            {saveState === "saved" && !isDirty
              ? "Saved"
              : saveState === "error"
                ? "Couldn't save — try again"
                : isDirty
                  ? "Unsaved changes"
                  : userId
                    ? "Synced to your account"
                    : "Saved on this device"}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={!isDirty || saveState === "saving"}
            className="h-8 px-3 text-[12px]"
          >
            {saveState === "saving" ? (
              <RiLoader4Line className="size-3.5 animate-spin" />
            ) : (
              <RiSaveLine className="size-3.5" />
            )}
            Save
          </Button>
        </div>

        {/* Preview */}
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <RiEyeLine className="size-3.5" />
            Preview
          </p>
          <div className="truncate rounded-md bg-secondary/40 px-3.5 py-2.5 font-mono text-[13px] text-muted-foreground">
            {preview}
          </div>
        </div>

        {/* Variables */}
        <div className="space-y-2 pt-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <RiFunctionLine className="size-3.5" />
            Variables
          </p>
          <ul className="space-y-2">
            {EXPORT_FILENAME_VARIABLES.map((variable) => (
              <li key={variable.token} className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => insertToken(variable.token)}
                  className="shrink-0 cursor-pointer rounded-full bg-secondary/70 px-2.5 py-1 font-mono text-[11px] text-foreground ring-1 ring-border/50 transition-colors hover:bg-secondary"
                  title={`Insert ${variable.token}`}
                >
                  {variable.token}
                </button>
                <span className="text-[12px] text-muted-foreground">
                  {variable.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Shortcuts                                                                   */
/* -------------------------------------------------------------------------- */

function ShortcutsSection() {
  const [isApple, setIsApple] = React.useState(true)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setIsApple(isApplePlatform()), [])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Shortcuts"
        description="Quickly access common actions to save time."
      />

      <div className="space-y-6">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-1 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {group.title}
            </p>
            <div className="divide-y divide-border/50">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="text-[13px] text-foreground/80">
                    {item.label}
                  </span>
                  <span className="flex items-center gap-1">
                    {item.keys.map((key, i) => (
                      <kbd
                        key={`${item.label}-${i}`}
                        className="inline-flex min-w-6 items-center justify-center rounded-md bg-secondary/70 px-1.5 py-1 font-mono text-[11px] text-foreground/80 ring-1 ring-border/50"
                      >
                        {formatShortcutKey(key, isApple)}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-[12px] text-muted-foreground">{description}</p>
    </div>
  )
}
