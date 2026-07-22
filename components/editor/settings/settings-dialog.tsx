"use client"

import * as React from "react"
import {
  RiCheckLine,
  RiCloseLine,
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
  RiUserLine,
  RiUserSettingsLine,
} from "@remixicon/react"
import { LayoutGroup, motion } from "motion/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

import { AccountAvatar } from "@/components/editor/account-avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { authClient, useSession } from "@/lib/auth-client"
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

type SettingsSection = "profile" | "account" | "export" | "shortcuts"

const NAV_ITEMS: {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "profile", label: "Profile", icon: RiUserLine },
  { id: "account", label: "Account", icon: RiUserSettingsLine },
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
          Manage your profile, export format, and view keyboard shortcuts.
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
          <nav className="flex w-full shrink-0 flex-row gap-0.5 overflow-x-auto border-b border-border/60 bg-card p-2 lg:w-60 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:p-3">
            <p className="hidden px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase lg:block">
              Settings
            </p>
            <div className="flex gap-0.5 lg:block">
              <LayoutGroup id="settings-nav">
                {NAV_ITEMS.map((item) => {
                  const active = section === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={cn(
                        "relative flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors lg:w-full lg:justify-start",
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
                      <item.icon className="relative z-10 size-3.5" />
                      <span className="relative z-10">{item.label}</span>
                    </button>
                  )
                })}
              </LayoutGroup>
            </div>
          </nav>

          {/* Content — darker surface; keep scroll, hide scrollbar chrome */}
          <div className="min-w-0 flex-1 [scrollbar-width:none] overflow-y-auto bg-background px-4 py-5 sm:px-8 sm:py-7 [&::-webkit-scrollbar]:hidden">
            {section === "profile" && <ProfileSection />}
            {section === "account" && <AccountSection />}
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

  return (
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
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <opt.icon className="relative z-10 size-4" />
              <span className="relative z-10">{opt.label}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
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
      await authClient.signOut()
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
          await authClient.signOut()
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
      await authClient.signOut()
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
          className="shrink-0"
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
                  className="min-w-[7rem] justify-self-end"
                >
                  {revokingId === item.id ? (
                    <>
                      <RiLoader4Line className="size-3.5 animate-spin" />
                      Logging out
                    </>
                  ) : (
                    "Log out"
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
