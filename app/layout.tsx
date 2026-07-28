import {
  Geist,
  Geist_Mono,
  Inter,
  Poppins,
  Playfair_Display,
  Roboto,
  Space_Grotesk,
  Outfit,
  Caveat,
  Fira_Code,
  Lora,
  Nunito,
  Raleway,
  Oswald,
  Dancing_Script,
  Doto,
} from "next/font/google"

import NextTopLoader from "nextjs-toploader"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { WebMcpProvider } from "@/components/web-mcp-provider"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"

const siteUrl = new URL("https://tokokino.com")
const opengraphImageUrl = new URL("/opengraph.png?v=2", siteUrl)
const siteTitle = "Tokokino - Screenshot & Product Demo Editor"
const siteDescription =
  "Create polished product screenshots and animated demos with device frames, backgrounds, annotations, timeline editing, and fast image or GIF/WebM exports."

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "Tokokino",
  title: {
    default: siteTitle,
    template: "%s | Tokokino",
  },
  description: siteDescription,
  keywords: [
    "screenshot mockup generator",
    "product demo editor",
    "animated product demos",
    "timeline video editor",
    "beautiful screenshots",
    "website screenshot mockup",
    "app screenshot mockup",
    "browser frame mockup",
    "device frame mockup",
    "screenshot editor",
    "social media screenshot",
    "product screenshot",
    "Tokokino",
  ],
  authors: [{ name: "Shiva Bhattacharjee" }],
  creator: "Shiva Bhattacharjee",
  publisher: "Tokokino",
  category: "Design",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/logo.png", sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    type: "website",
    locale: "en_US",
    siteName: "Tokokino",
    images: [
      {
        url: opengraphImageUrl,
        width: 1920,
        height: 1008,
        alt: "Tokokino screenshot and animated demo editor preview",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: opengraphImageUrl,
        width: 1920,
        height: 1008,
        alt: "Tokokino screenshot and animated demo editor preview",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

// Everything below is only ever selected from the editor's text-layer font
// picker. `preload: false` keeps the @font-face rule (so `var(--font-*)` still
// resolves) but drops the <link rel=preload>, so a route that never renders the
// family never downloads it. next/font needs literal option objects, so these
// cannot share a spread constant.
const fontInter = Inter({
  subsets: ["latin"],
  preload: false,
  variable: "--font-inter",
})
const fontPoppins = Poppins({
  subsets: ["latin"],
  preload: false,
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
})
const fontPlayfair = Playfair_Display({
  subsets: ["latin"],
  preload: false,
  variable: "--font-playfair",
})
const fontRoboto = Roboto({
  subsets: ["latin"],
  preload: false,
  variable: "--font-roboto",
})
const fontSpaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  preload: false,
  variable: "--font-space-grotesk",
})
const fontOutfit = Outfit({
  subsets: ["latin"],
  preload: false,
  variable: "--font-outfit",
})
const fontCaveat = Caveat({
  subsets: ["latin"],
  preload: false,
  variable: "--font-caveat",
})
const fontFiraCode = Fira_Code({
  subsets: ["latin"],
  preload: false,
  variable: "--font-fira-code",
})
const fontLora = Lora({
  subsets: ["latin"],
  preload: false,
  variable: "--font-lora",
})
const fontNunito = Nunito({
  subsets: ["latin"],
  preload: false,
  variable: "--font-nunito",
})
const fontRaleway = Raleway({
  subsets: ["latin"],
  preload: false,
  variable: "--font-raleway",
})
const fontOswald = Oswald({
  subsets: ["latin"],
  preload: false,
  variable: "--font-oswald",
})
const fontDancingScript = Dancing_Script({
  subsets: ["latin"],
  preload: false,
  variable: "--font-dancing-script",
})
const fontDoto = Doto({
  subsets: ["latin"],
  preload: false,
  variable: "--font-doto",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      // Opts route transitions out of the global `scroll-behavior: smooth`, so
      // navigations jump to the top instead of animating the whole page there.
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontSans.variable,
        fontMono.variable,
        fontInter.variable,
        fontPoppins.variable,
        fontPlayfair.variable,
        fontRoboto.variable,
        fontSpaceGrotesk.variable,
        fontOutfit.variable,
        fontCaveat.variable,
        fontFiraCode.variable,
        fontLora.variable,
        fontNunito.variable,
        fontRaleway.variable,
        fontOswald.variable,
        fontDancingScript.variable,
        fontDoto.variable,
        "font-sans"
      )}
    >
      <head>
        <link rel="preconnect" href="https://assets.tokokino.com" />
        <link rel="dns-prefetch" href="https://assets.tokokino.com" />
        {/*
          The resource-timing buffer holds 250 entries by default and silently
          drops everything after that. A chunk-heavy editor boot can fill it,
          costing `lib/offline/offline-shell.ts` exactly the lazily loaded
          chunks it reads the timeline for. It lives here rather than in the
          editor's own layout because React never runs a script it creates
          during a client render, so a client navigation into /app would skip
          it — the root layout is only ever rendered into the initial HTML.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "performance.setResourceTimingBufferSize?.(1000)",
          }}
        />
      </head>
      <body>
        <NextTopLoader
          color="#ff5b6e"
          height={2.5}
          shadow="0 0 10px #ff5b6e, 0 0 5px #ff5b6e"
          showSpinner={false}
          crawlSpeed={200}
          speed={300}
          easing="ease"
        />
        <div className="mx-auto max-w-[1800px]">
          <ThemeProvider defaultTheme="dark">
            <TooltipProvider delayDuration={150}>
              {children}
              <WebMcpProvider />
              <Toaster position="top-center" />
            </TooltipProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  )
}
