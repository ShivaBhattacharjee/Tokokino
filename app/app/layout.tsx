export default function ScreenshotsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-svh overflow-hidden bg-background text-foreground">
      {/*
        The resource-timing buffer holds 250 entries by default and silently
        drops everything after that. A chunk-heavy editor boot can fill it,
        costing `lib/offline/offline-shell.ts` exactly the lazily loaded chunks
        it reads the timeline for. Raised inline so it takes effect before the
        page's own scripts start loading.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: "performance.setResourceTimingBufferSize?.(1000)",
        }}
      />
      {children}
    </div>
  )
}
