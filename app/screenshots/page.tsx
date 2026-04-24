import { Canvas } from "@/components/editor/canvas"
import { EffectsSidebar } from "@/components/editor/effects-sidebar"
import { FloatingToolbar } from "@/components/editor/floating-toolbar"
import { Inspector } from "@/components/editor/inspector"
import { StatusBar } from "@/components/editor/status-bar"
import { TopBar } from "@/components/editor/top-bar"

export default function ScreenshotsPage() {
  return (
    <div className="flex h-svh min-h-0 flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <EffectsSidebar />
        <div className="relative flex min-h-0 flex-1">
          <Canvas />
          <FloatingToolbar />
        </div>
        <Inspector />
      </div>
      <StatusBar />
    </div>
  )
}
