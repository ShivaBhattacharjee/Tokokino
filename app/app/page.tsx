"use client"

import dynamic from "next/dynamic"
import { useSyncExternalStore } from "react"

import { isSafariUserAgent } from "@/lib/browser-support"

import EditorLoading from "./loading"
import { SafariUnavailable } from "./safari-unavailable"

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

type BrowserSupport = "checking" | "supported" | "safari"

const subscribeBrowserSupport = () => () => undefined
const getBrowserSupport = (): BrowserSupport =>
  isSafariUserAgent(window.navigator.userAgent) ? "safari" : "supported"
const getServerBrowserSupport = (): BrowserSupport => "checking"

export default function ScreenshotsPage() {
  const browser = useSyncExternalStore(
    subscribeBrowserSupport,
    getBrowserSupport,
    getServerBrowserSupport
  )

  if (browser === "checking") return <EditorLoading />
  if (browser === "safari") return <SafariUnavailable />
  return <EditorApp />
}
