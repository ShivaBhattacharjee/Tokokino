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

export const metadata: Metadata = {
  title: "Noctivy — Create Stunning Screenshots Instantly",
  description:
    "Transform screenshots into beautiful, share-ready visuals with device mockups, browser frames, gradients, and more. Free, fast, and right in your browser.",
  keywords: [
    "screenshot",
    "mockup",
    "device frame",
    "browser frame",
    "beautiful screenshots",
    "screenshot editor",
    "design tool",
  ],
  authors: [{ name: "Shiva Bhattacharjee" }],
  creator: "Shiva Bhattacharjee",
  openGraph: {
    title: "Beautiful Screenshots",
    description:
      "Create stunning, share-ready screenshots with device mockups, browser frames, and custom backgrounds.",
    type: "website",
    locale: "en_US",
    siteName: "Beautiful Screenshots",
  },
  twitter: {
    card: "summary_large_image",
    title: "Beautiful Screenshots",
    description:
      "Create stunning, share-ready screenshots with device mockups, browser frames, and custom backgrounds.",
  },
  robots: {
    index: true,
    follow: true,
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
              <Toaster position="top-center" />
            </TooltipProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  )
}
