import { AnalyticsIdentity } from "@/components/analytics-identity"

export default function ScreenshotsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-svh overflow-hidden bg-background text-foreground">
      <AnalyticsIdentity />
      {children}
    </div>
  )
}
