"use client"

import * as React from "react"
import Link from "next/link"
import {
  RiAddLine,
  RiCheckLine,
  RiCloseLine,
  RiCodeLine,
  RiComputerLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiFileCopyLine,
  RiGoogleFill,
  RiLoader4Line,
  RiLogoutBoxLine,
  RiMapPinLine,
  RiMoonLine,
  RiResetLeftLine,
  RiSaveLine,
  RiShieldCheckLine,
  RiSunLine,
  RiFunctionLine,
  RiImageLine,
  RiKeyboardLine,
  RiKeyLine,
  RiUserLine,
  RiUserSettingsLine,
} from "@remixicon/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { AccountAvatar } from "@/components/editor/account-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { authClient, signOut, useSession } from "@/lib/auth-client"
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

type SettingsSection =
  | "profile"
  | "account"
  | "developer"
  | "export"
  | "shortcuts"

const NAV_ITEMS: {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "profile", label: "Profile", icon: RiUserLine },
  { id: "account", label: "Account", icon: RiUserSettingsLine },
  { id: "developer", label: "Developer", icon: RiCodeLine },
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
  const [section, setSection] = React.useState<SettingsSection>("profile")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="h-[calc(100dvh-1rem)] max-h-[44rem] w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-md bg-background p-0 sm:h-160 sm:max-h-[88vh] sm:w-[92vw] sm:max-w-5xl"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your profile, API tokens, export format, and view keyboard
          shortcuts.
        </DialogDescription>

        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close settings"
            className="absolute top-3 right-3 z-20 hidden cursor-pointer rounded-sm bg-foreground/8 text-foreground/60 ring-1 ring-border/50 backdrop-blur-sm hover:bg-foreground/12 hover:text-foreground lg:inline-flex"
          >
            <RiCloseLine />
          </Button>
        </DialogClose>

        <div className="flex h-full min-h-0 min-w-0 flex-col lg:flex-row">
          {/* Mobile header — close button gets its own row so the tabs below it never collide with it */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-card px-3 py-2.5 lg:hidden">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Settings
            </p>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close settings"
                className="cursor-pointer rounded-sm bg-foreground/8 text-foreground/60 ring-1 ring-border/50 hover:bg-foreground/12 hover:text-foreground"
              >
                <RiCloseLine />
              </Button>
            </DialogClose>
          </div>

          {/* Sidebar — lighter surface */}
          <nav className="flex w-full shrink-0 flex-row gap-0.5 overflow-x-auto border-b border-border/60 bg-card p-2 lg:w-48 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:p-2.5">
            <p className="hidden px-2 pt-1 pb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase lg:block">
              Settings
            </p>
            <div className="flex gap-1.5 lg:flex-col">
              {NAV_ITEMS.map((item) => {
                const active = section === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "relative flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors duration-150 lg:w-full lg:justify-start",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Content — darker surface; keep scroll, hide scrollbar chrome */}
          <div className="min-w-0 flex-1 [scrollbar-width:none] overflow-y-auto bg-background px-4 py-5 sm:px-8 sm:py-7 [&::-webkit-scrollbar]:hidden">
            {section === "profile" && <ProfileSection />}
            {section === "account" && <AccountSection />}
            {section === "developer" && <DeveloperSection />}
            {section === "export" && <ExportSection />}
            {section === "shortcuts" && <ShortcutsSection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const THEME_OPTIONS: {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: "light", label: "Light", icon: RiSunLine },
  { value: "dark", label: "Dark", icon: RiMoonLine },
  { value: "system", label: "System", icon: RiComputerLine },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), [])
  const active = mounted ? (theme ?? "system") : "system"

  const activeOption =
    THEME_OPTIONS.find((opt) => opt.value === active) ?? THEME_OPTIONS[2]

  return (
    <>
      <Select value={active} onValueChange={setTheme}>
        <SelectTrigger
          size="default"
          aria-label="Appearance"
          className="w-full text-[13px] data-[size=default]:h-10 sm:hidden"
        >
          <SelectValue>
            <activeOption.icon className="size-4 text-primary" />
            {activeOption.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {THEME_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <opt.icon className="size-4" />
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="hidden w-full grid-cols-3 gap-2.5 sm:grid">
        {THEME_OPTIONS.map((opt) => {
          const isActive = active === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={isActive}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors",
                isActive
                  ? "border-primary bg-primary/8 text-foreground"
                  : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <opt.icon className={cn("size-5", isActive && "text-primary")} />
              <span className="text-[13px] font-medium">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

type LinkedAccount = { providerId: string; accountId: string }

const SOCIAL_PROVIDERS: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  google: { label: "Google", icon: RiGoogleFill },
}

type SessionUser = NonNullable<ReturnType<typeof useSession>["data"]>["user"]

function ProfileSection() {
  const { data: session, isPending } = useSession()
  const user = session?.user

  if (!user && !isPending) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Profile"
          description="Manage how you appear in Tokokino."
        />
        <div className="space-y-8">
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-foreground">
              Appearance
            </p>
            <ThemeToggle />
          </div>
          <div className="rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-[13px] text-muted-foreground">
            Sign in to view your profile and connected accounts.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Profile"
        description="Manage how you appear in Tokokino."
      />

      <div className="space-y-8">
        <ProfileHeader user={user} />

        <Divider />

        <div className="space-y-3">
          <p className="text-[13px] font-medium text-foreground">Appearance</p>
          <p className="text-[12px] text-muted-foreground">
            Choose how Tokokino looks on this device.
          </p>
          <ThemeToggle />
        </div>

        <Divider />

        <EmailField user={user} />

        <Divider />

        <ConnectedAccounts />
      </div>
    </div>
  )
}

function ProfileHeader({ user }: { user: SessionUser | undefined }) {
  return (
    <div className="flex items-center gap-4">
      <AccountAvatar
        src={user?.image}
        name={user?.name}
        className="size-16 rounded-full ring-1 ring-border/70"
        iconClassName="size-6"
      />
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold text-foreground">
          {user?.name?.trim() || "Your account"}
        </p>
        {user?.email ? (
          <p className="truncate text-[13px] text-muted-foreground">
            {user.email}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function EmailField({ user }: { user: SessionUser | undefined }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">Email</p>
        <p className="text-[12px] text-muted-foreground">
          The address we use to sign you in and send account notices.
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-md border border-border/60 bg-secondary/30 px-3.5 py-3">
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
          {user?.email ?? "—"}
        </span>
        {user?.emailVerified ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
            <RiShieldCheckLine className="size-3.5" />
            Verified
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ConnectedAccounts() {
  const [accounts, setAccounts] = React.useState<LinkedAccount[] | null>(null)

  React.useEffect(() => {
    let cancelled = false
    authClient
      .listAccounts()
      .then((res) => {
        if (cancelled) return
        const list = (res.data ?? []) as LinkedAccount[]
        setAccounts(list.filter((a) => a.providerId in SOCIAL_PROVIDERS))
      })
      .catch(() => {
        // Network/auth failure — settle to empty so we don't hang on null and
        // don't surface an unhandled rejection.
        if (!cancelled) setAccounts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (accounts !== null && accounts.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">
          Connected accounts
        </p>
        <p className="text-[12px] text-muted-foreground">
          Providers linked to your account.
        </p>
      </div>
      <div className="space-y-2">
        {(accounts ?? []).map((account) => {
          const provider = SOCIAL_PROVIDERS[account.providerId]
          const Icon = provider.icon
          return (
            <div
              key={account.providerId}
              className="flex items-center gap-3 rounded-md border border-border/60 bg-secondary/30 px-3.5 py-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background ring-1 ring-border/60">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">
                  {provider.label}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  Connected
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground">
                <RiCheckLine className="size-4 text-emerald-500" />
                Linked
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type ManagedSession = {
  id: string
  device: string
  location: string
  lastActive: string
  current: boolean
}

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000)
  const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ]
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  let duration = seconds
  for (const [amount, unit] of ranges) {
    if (Math.abs(duration) < amount) return formatter.format(duration, unit)
    duration = Math.round(duration / amount)
  }
  return formatter.format(duration, "year")
}

function AccountSection() {
  const { data: session, isPending } = useSession()
  const user = session?.user
  const [sessions, setSessions] = React.useState<ManagedSession[] | null>(null)
  const [isRevokingAll, setIsRevokingAll] = React.useState(false)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("")
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [copiedUserId, setCopiedUserId] = React.useState(false)
  const copyResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current)
    },
    []
  )

  React.useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch("/api/account", { credentials: "include" })
        if (!response.ok) throw new Error("Could not load sessions")
        const body: { sessions: ManagedSession[] } = await response.json()
        if (!cancelled) setSessions(body.sessions)
      } catch {
        if (cancelled) return
        toast.error("Couldn't load active sessions")
        setSessions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const postSessionAction = React.useCallback(
    async (body: { action: "revoke" | "revoke-all"; sessionId?: string }) => {
      const response = await fetch("/api/account", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error("Could not update session")
      const result: { current: boolean } = await response.json()
      return result
    },
    []
  )

  const handleLogOutAll = React.useCallback(async () => {
    setIsRevokingAll(true)
    try {
      await postSessionAction({ action: "revoke-all" })
      await signOut()
      toast.success("Logged out of all devices")
    } catch {
      toast.error("Couldn't log out of all devices")
    } finally {
      setIsRevokingAll(false)
    }
  }, [postSessionAction])

  const handleLogOutSession = React.useCallback(
    async (item: ManagedSession) => {
      setRevokingId(item.id)
      try {
        const result = await postSessionAction({
          action: "revoke",
          sessionId: item.id,
        })
        if (result.current) {
          await signOut()
          toast.success("Logged out of this device")
          return
        }
        setSessions(
          (current) =>
            current?.filter((session) => session.id !== item.id) ?? []
        )
        toast.success("Device logged out")
      } catch {
        toast.error("Couldn't log out that device")
      } finally {
        setRevokingId(null)
      }
    },
    [postSessionAction]
  )

  const userId = user?.id
  const copyUserId = React.useCallback(async () => {
    if (!userId) return
    try {
      await navigator.clipboard.writeText(userId)
      setCopiedUserId(true)
      if (copyResetRef.current) clearTimeout(copyResetRef.current)
      copyResetRef.current = setTimeout(() => setCopiedUserId(false), 1500)
    } catch {
      toast.error("Couldn't copy user ID")
    }
  }, [userId])

  const handleDeleteAccount = React.useCallback(async () => {
    if (deleteConfirmation !== "DELETE") return
    setIsDeleting(true)
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      })
      if (!response.ok) throw new Error("Could not delete account")
      await signOut()
      setDeleteOpen(false)
      toast.success("Account deletion started — you've been signed out")
    } catch {
      toast.error("Couldn't delete your account. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }, [deleteConfirmation])

  if (!user && !isPending) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Account"
          description="Manage your sessions and account security."
        />
        <div className="rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-[13px] text-muted-foreground">
          Sign in to manage active sessions and your account.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <SectionHeader
        title="Account"
        description="Sign out across devices, review sessions, and manage your account."
      />

      <section className="flex flex-col gap-3 border-b border-border/50 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-medium text-foreground">
            Log out of all devices
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            End every active Tokokino session, including this one.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          onClick={() => void handleLogOutAll()}
          disabled={isRevokingAll}
          className="shrink-0 border-destructive/50 bg-transparent hover:bg-destructive/10 dark:bg-transparent dark:hover:bg-destructive/10"
        >
          {isRevokingAll ? (
            <RiLoader4Line className="size-4 animate-spin" />
          ) : (
            <RiLogoutBoxLine className="size-4" />
          )}
          Log out
        </Button>
      </section>

      <section className="space-y-3 border-b border-border/50 pb-6">
        <p className="text-base font-medium text-foreground">User ID</p>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2.5">
          <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">
            {user?.id ?? "—"}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copiedUserId ? "User ID copied" : "Copy user ID"}
            onClick={() => void copyUserId()}
            className="shrink-0"
          >
            {copiedUserId ? (
              <RiCheckLine className="size-4 animate-in text-emerald-500 duration-200 zoom-in-50" />
            ) : (
              <RiFileCopyLine className="size-4" />
            )}
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            Active sessions
          </p>
          <p className="text-[12px] text-muted-foreground">
            Revoke any session you don&apos;t recognise.
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border border-border/50">
          <div className="min-w-[38rem] divide-y divide-border/50">
            <div className="grid grid-cols-[minmax(10rem,1.5fr)_minmax(9rem,1fr)_minmax(7rem,.8fr)_7.5rem] gap-4 bg-secondary/30 px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
              <span>Device</span>
              <span>Location</span>
              <span>Last active</span>
              <span className="text-right">Action</span>
            </div>
            {sessions?.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(10rem,1.5fr)_minmax(9rem,1fr)_minmax(7rem,.8fr)_7.5rem] items-center gap-4 px-4 py-3 text-[12px]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <RiComputerLine className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground">
                    {item.device}
                  </span>
                  {item.current ? (
                    <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                      Current
                    </span>
                  ) : null}
                </div>
                <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                  <RiMapPinLine className="size-3.5 shrink-0" />
                  {item.location}
                </span>
                <span
                  className="text-muted-foreground"
                  title={new Date(item.lastActive).toLocaleString()}
                >
                  {relativeTime(item.lastActive)}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="default"
                  onClick={() => void handleLogOutSession(item)}
                  disabled={revokingId === item.id}
                  className="min-w-[7rem] justify-self-end border-destructive/50 bg-transparent hover:bg-destructive/10 dark:bg-transparent dark:hover:bg-destructive/10"
                >
                  {revokingId === item.id ? (
                    <>
                      <RiLoader4Line className="size-3.5 animate-spin" />
                      Logging out
                    </>
                  ) : (
                    <>
                      <RiLogoutBoxLine className="size-3.5" />
                      Log out
                    </>
                  )}
                </Button>
              </div>
            ))}
            {sessions === null
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid animate-pulse grid-cols-[minmax(10rem,1.5fr)_minmax(9rem,1fr)_minmax(7rem,.8fr)_7.5rem] items-center gap-4 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-4 shrink-0 rounded bg-foreground/10" />
                      <span className="h-3.5 w-32 rounded bg-foreground/10" />
                    </div>
                    <span className="h-3.5 w-28 rounded bg-foreground/10" />
                    <span className="h-3.5 w-20 rounded bg-foreground/10" />
                    <span className="h-7 w-[7rem] justify-self-end rounded-md bg-foreground/10" />
                  </div>
                ))
              : null}
            {sessions?.length === 0 ? (
              <div className="px-4 py-5 text-[12px] text-muted-foreground">
                No active sessions found.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-medium text-foreground">
            Delete your account permanently
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            This removes your shares, drafts, presets, preferences, and active
            sessions.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          onClick={() => setDeleteOpen(true)}
          className="shrink-0"
        >
          <RiDeleteBinLine className="size-4" />
          Delete account
        </Button>
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent showCloseButton={false} className="max-w-md p-5">
          <DialogTitle className="text-base font-semibold">
            Delete account permanently?
          </DialogTitle>
          <DialogDescription className="mt-2">
            This cannot be undone. Your shares, drafts, custom presets,
            preferences, connected accounts, and active sessions will be
            deleted.
          </DialogDescription>
          <label className="mt-1 block space-y-3 text-[12px] font-medium text-foreground">
            <span className="inline-flex items-center gap-1.5">
              Type
              <code className="rounded-md border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono font-bold text-red-500">
                DELETE
              </code>
              to confirm
            </span>
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoComplete="off"
              className="w-full rounded-md border border-border/60 bg-secondary/30 px-3 py-2.5 text-[13px] font-normal text-foreground outline-none focus:border-red-500/60"
            />
          </label>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDeleteAccount()}
              disabled={deleteConfirmation !== "DELETE" || isDeleting}
            >
              {isDeleting ? (
                <RiLoader4Line className="size-4 animate-spin" />
              ) : (
                <RiDeleteBinLine className="size-4" />
              )}
              Delete account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

type ApiTokenSummary = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

const TOKEN_EXPIRY_OPTIONS = [
  { value: "never", label: "No expiry" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "365d", label: "1 year" },
] as const

function DeveloperSection() {
  const { data: session, isPending } = useSession()
  const user = session?.user
  const [tokens, setTokens] = React.useState<ApiTokenSummary[] | null>(null)
  const [name, setName] = React.useState("")
  const [expiry, setExpiry] = React.useState<string>("never")
  const [isCreating, setIsCreating] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [revokeTarget, setRevokeTarget] =
    React.useState<ApiTokenSummary | null>(null)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)
  const [newToken, setNewToken] = React.useState<string | null>(null)
  const [copiedToken, setCopiedToken] = React.useState(false)
  const copyResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(
    () => () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current)
    },
    []
  )

  React.useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch("/api/tokens", { credentials: "include" })
        if (!response.ok) throw new Error("Could not load tokens")
        const body: { tokens: ApiTokenSummary[] } = await response.json()
        if (!cancelled) setTokens(body.tokens)
      } catch {
        if (cancelled) return
        toast.error("Couldn't load API tokens")
        setTokens([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleCreate = React.useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Give the token a name first")
      return
    }
    setIsCreating(true)
    try {
      const days =
        expiry === "30d"
          ? 30
          : expiry === "90d"
            ? 90
            : expiry === "365d"
              ? 365
              : null
      const response = await fetch("/api/tokens", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          expiresAt: days
            ? new Date(Date.now() + days * 86400_000).toISOString()
            : null,
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        token?: string
        id?: string
        name?: string
        prefix?: string
        createdAt?: string
        lastUsedAt?: string | null
        expiresAt?: string | null
      } | null
      if (!response.ok) throw new Error(body?.error ?? "Could not create token")
      if (
        !body?.token ||
        !body.id ||
        !body.name ||
        !body.prefix ||
        !body.createdAt
      ) {
        throw new Error("Could not create token")
      }
      setNewToken(body.token)
      setCopiedToken(false)
      setName("")
      setExpiry("never")
      setCreateOpen(false)
      // The create response already carries the stored metadata, so add the
      // row directly instead of refetching the list (no skeleton flash).
      const record: ApiTokenSummary = {
        id: body.id,
        name: body.name,
        prefix: body.prefix,
        createdAt: body.createdAt,
        lastUsedAt: body.lastUsedAt ?? null,
        expiresAt: body.expiresAt ?? null,
      }
      setTokens((current) => [record, ...(current ?? [])])
      toast.success("API token created")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't create API token"
      )
    } finally {
      setIsCreating(false)
    }
  }, [name, expiry])

  const handleRevoke = React.useCallback(async (token: ApiTokenSummary) => {
    setRevokingId(token.id)
    try {
      const response = await fetch(`/api/tokens/${token.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) throw new Error("Could not revoke token")
      setTokens(
        (current) => current?.filter((item) => item.id !== token.id) ?? []
      )
      setRevokeTarget(null)
      toast.success("API token revoked")
    } catch {
      toast.error("Couldn't revoke that token")
    } finally {
      setRevokingId(null)
    }
  }, [])

  const copyToken = React.useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedToken(true)
      if (copyResetRef.current) clearTimeout(copyResetRef.current)
      copyResetRef.current = setTimeout(() => setCopiedToken(false), 1500)
    } catch {
      toast.error("Couldn't copy token")
    }
  }, [])

  if (!user && !isPending) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Developer"
          description="Create personal access tokens for the Tokokino API."
        />
        <div className="rounded-lg border border-border/60 bg-secondary/30 px-4 py-3 text-[13px] text-muted-foreground">
          Sign in to generate personal access tokens.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <SectionHeader
        title="Developer"
        description="Personal access tokens authenticate API requests without a browser session. Send one as an Authorization: Bearer header."
      />

      <Dialog
        open={newToken !== null}
        onOpenChange={(open) => {
          if (!open) setNewToken(null)
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-md gap-3 p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Copy your new token
            </DialogTitle>
            <DialogDescription>
              It won&apos;t be shown again. Store it somewhere safe. It acts as
              your account on every API call.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 py-2.5">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">
              {newToken}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={copiedToken ? "Token copied" : "Copy token"}
              onClick={() => newToken && void copyToken(newToken)}
              className="shrink-0 hover:bg-accent hover:text-accent-foreground"
            >
              {copiedToken ? (
                <RiCheckLine className="size-4 animate-in text-emerald-500 duration-200 zoom-in-50" />
              ) : (
                <RiFileCopyLine className="size-4" />
              )}
            </Button>
          </div>
          <div>
            <Button
              type="button"
              onClick={() => setNewToken(null)}
              className="w-full"
            >
              Okay
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <section className="flex justify-end border-b border-border/50 pb-6">
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-9 shrink-0 px-4"
        >
          <RiAddLine className="size-4" />
          New token
        </Button>
      </section>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!isCreating) setCreateOpen(open)
        }}
      >
        <DialogContent className="max-w-md gap-3 p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Create new token
            </DialogTitle>
            <DialogDescription>
              Give it a name and an expiry. The secret is shown once after
              creation. Tokens act as you, so keep them secret.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void handleCreate()
            }}
          >
            <div className="grid gap-1">
              <label
                htmlFor="new-token-name"
                className="block text-[12px] font-medium text-foreground"
              >
                Name
              </label>
              <Input
                id="new-token-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. CI upload script"
                maxLength={60}
                autoComplete="off"
                className="h-10 px-3 text-[13px]"
              />
            </div>
            <div className="grid gap-1">
              <span className="block text-[12px] font-medium text-foreground">
                Expiry
              </span>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger
                  size="default"
                  aria-label="Token expiry"
                  className="w-full text-[13px] data-[size=default]:h-10"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="rounded-md border-border/70 bg-popover p-1 shadow-2xl"
                >
                  {TOKEN_EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="sm:items-center sm:justify-between">
              <Link
                href="/developers#authentication"
                target="_blank"
                rel="noreferrer"
                className="hidden items-center gap-1.5 text-[12px] font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline sm:inline-flex"
              >
                <RiCodeLine className="size-4" />
                Developer docs
              </Link>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isCreating}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isCreating || !name.trim()}>
                  {isCreating ? (
                    <RiLoader4Line className="size-4 animate-spin" />
                  ) : (
                    <RiKeyLine className="size-4" />
                  )}
                  Generate token
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <section className="space-y-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            Active tokens
          </p>
          <p className="text-[12px] text-muted-foreground">
            Revoking a token immediately stops every integration using it.
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border border-border/50">
          <div className="min-w-[44rem] divide-y divide-border/50">
            <div className="grid grid-cols-[minmax(10rem,1.6fr)_minmax(7rem,.9fr)_minmax(7rem,.9fr)_minmax(8rem,1fr)_3.5rem] gap-4 bg-secondary/30 px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
              <span>Token</span>
              <span>Created</span>
              <span>Expires</span>
              <span>Last used</span>
              <span className="text-right">Action</span>
            </div>
            {tokens?.map((token) => (
              <div
                key={token.id}
                className="grid grid-cols-[minmax(10rem,1.6fr)_minmax(7rem,.9fr)_minmax(7rem,.9fr)_minmax(8rem,1fr)_3.5rem] items-center gap-4 px-4 py-3 text-[12px]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <RiKeyLine className="size-4 shrink-0 text-muted-foreground" />
                  <p className="truncate text-foreground">{token.name}</p>
                </div>
                <span
                  className="text-muted-foreground"
                  title={new Date(token.createdAt).toLocaleString()}
                >
                  {new Date(token.createdAt).toLocaleDateString()}
                </span>
                <span
                  className="text-muted-foreground"
                  title={
                    token.expiresAt
                      ? new Date(token.expiresAt).toLocaleString()
                      : undefined
                  }
                >
                  {token.expiresAt
                    ? new Date(token.expiresAt).toLocaleDateString()
                    : "No expiry"}
                </span>
                <span
                  className="text-muted-foreground"
                  title={
                    token.lastUsedAt
                      ? new Date(token.lastUsedAt).toLocaleString()
                      : undefined
                  }
                >
                  {token.lastUsedAt
                    ? relativeTime(token.lastUsedAt)
                    : "Never used"}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  onClick={() => setRevokeTarget(token)}
                  disabled={revokingId === token.id}
                  aria-label={`Revoke ${token.name}`}
                  title={`Revoke ${token.name}`}
                  className="justify-self-end bg-transparent hover:bg-destructive/10 dark:bg-transparent dark:hover:bg-destructive/10"
                >
                  <RiDeleteBinLine className="size-4" />
                </Button>
              </div>
            ))}
            {tokens === null
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid animate-pulse grid-cols-[minmax(10rem,1.6fr)_minmax(7rem,.9fr)_minmax(7rem,.9fr)_minmax(8rem,1fr)_3.5rem] items-center gap-4 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-4 shrink-0 rounded bg-foreground/10" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <span className="block h-3.5 w-32 rounded bg-foreground/10" />
                        <span className="block h-3 w-24 rounded bg-foreground/10" />
                      </div>
                    </div>
                    <span className="h-3.5 w-20 rounded bg-foreground/10" />
                    <span className="h-3.5 w-20 rounded bg-foreground/10" />
                    <span className="h-3.5 w-24 rounded bg-foreground/10" />
                    <span className="size-6 justify-self-end rounded-md bg-foreground/10" />
                  </div>
                ))
              : null}
            {tokens?.length === 0 ? (
              <div className="px-4 py-5 text-[12px] text-muted-foreground">
                No tokens yet. Create one with New token to call the API from
                scripts, CI, or agents.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke token?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{revokeTarget?.name}&rdquo; will stop working immediately.
              Every script, CI job, or agent using it will start getting
              unauthorized errors. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTarget && void handleRevoke(revokeTarget)}
              disabled={revokingId !== null}
              className="text-destructive-foreground bg-destructive hover:bg-destructive/90"
            >
              {revokingId !== null ? (
                <>
                  <RiLoader4Line className="size-4 animate-spin" />
                  Revoking
                </>
              ) : (
                <>Revoke</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Divider() {
  return <div className="h-px w-full bg-border/50" />
}

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
        description="Only the variables you include are used in the filename."
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
