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

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"

const siteUrl = new URL("https://tokokino.com")
const opengraphImageUrl = new URL("/opengraph.png?v=2", siteUrl)

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: "Tokokino",
  title: {
    default: "Tokokino - Beautiful Screenshot Mockups",
    template: "%s | Tokokino",
  },
  description:
    "Create polished screenshot mockups with browser frames, device frames, gradients, backgrounds, shadows, annotations, and export-ready visuals.",
  keywords: [
    "screenshot mockup generator",
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
    icon: [{ url: "/logo.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/logo.png", sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    title: "Tokokino - Beautiful Screenshot Mockups",
    description:
      "Turn raw screenshots into polished website, app, and product visuals with frames, backgrounds, shadows, annotations, and fast exports.",
    url: "/",
    type: "website",
    locale: "en_US",
    siteName: "Tokokino",
    images: [
      {
        url: opengraphImageUrl,
        width: 1920,
        height: 1008,
        alt: "Tokokino screenshot mockup editor preview",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tokokino - Beautiful Screenshot Mockups",
    description:
      "Create polished screenshot mockups for websites, apps, products, decks, and social posts.",
    images: [
      {
        url: opengraphImageUrl,
        width: 1920,
        height: 1008,
        alt: "Tokokino screenshot mockup editor preview",
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
const fontInter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const fontPoppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
})
const fontPlayfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
})
const fontRoboto = Roboto({ subsets: ["latin"], variable: "--font-roboto" })
const fontSpaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
})
const fontOutfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" })
const fontCaveat = Caveat({ subsets: ["latin"], variable: "--font-caveat" })
const fontFiraCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
})
const fontLora = Lora({ subsets: ["latin"], variable: "--font-lora" })
const fontNunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" })
const fontRaleway = Raleway({ subsets: ["latin"], variable: "--font-raleway" })
const fontOswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" })
const fontDancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing-script",
})
const fontDoto = Doto({ subsets: ["latin"], variable: "--font-doto" })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
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
      <body>
        <div className="mx-auto max-w-[1800px]">
          <ThemeProvider defaultTheme="dark">
            <TooltipProvider delayDuration={150}>
              {children}
              <Toaster position="top-right" />
            </TooltipProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  )
}
