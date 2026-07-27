"use client"

import dynamic from "next/dynamic"
import EditorLoading from "./loading"

// The editor only ever runs in the browser — WebCodecs, WebGL, canvas capture
// and IndexedDB persistence all need a real DOM, so its server render produced
// nothing usable. It did, however, pull the whole editor graph (mediabunny,
// @xyflow, dnd-kit) into the server compile, and OpenNext bundles every server
// chunk into the Worker, which has a hard size limit. Loading it client-side
// keeps that graph out of the Worker entirely.
const EditorApp = dynamic(() => import("@/components/editor/editor-app"), {
  ssr: false,
  loading: () => <EditorLoading />,
})

export default function ScreenshotsPage() {
  return <EditorApp />
}
