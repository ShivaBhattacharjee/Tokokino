import { Canvas } from "@/components/editor/canvas"
import { EffectsSidebar } from "@/components/editor/effects-sidebar"
import { FloatingToolbar } from "@/components/editor/floating-toolbar"
import { Inspector } from "@/components/editor/inspector"
import { IpadProSidebar } from "@/components/editor/ipad-pro-sidebar"
import { MobileControls } from "@/components/editor/mobile-controls"
import { TopBar } from "@/components/editor/top-bar"

export default function ScreenshotsPage() {
  return (
    <div className="flex h-svh min-h-0 flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <EffectsSidebar className="hidden xl:flex" />
        <div className="relative flex min-h-0 flex-1">
          <Canvas />
          <FloatingToolbar />
          <IpadProSidebar />
        </div>
        <Inspector className="hidden lg:flex" />
        <MobileControls />
      </div>
    </div>
  )
}
