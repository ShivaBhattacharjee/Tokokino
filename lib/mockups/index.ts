export type MockupOrientation = "portrait" | "landscape"

export type DeviceMockupFile = (typeof DEVICE_MOCKUP_FILES)[number]

export type DeviceMockupAsset = {
  deviceId: string
  deviceName: string
  color: string
  orientation: MockupOrientation
  file: DeviceMockupFile
  src: string
}

export type DeviceMockup = {
  id: string
  name: string
  thumbnailSrc: string
  colors: string[]
  orientations: MockupOrientation[]
  assets: DeviceMockupAsset[]
}

const R2_PUBLIC_BASE_URL = "https://assets.tokokino.com"

export const DEVICE_MOCKUPS_BASE_URL = `${R2_PUBLIC_BASE_URL}/Device-Mockups/device-mockups`
export const DEVICE_MOCKUP_THUMBNAILS_BASE_URL = `${DEVICE_MOCKUPS_BASE_URL}/thumbnails`

export const DEVICE_MOCKUP_FILES = [
  "apple_watch_10_42mm_aluminum_sport_band__black_portrait.webp",
  "apple_watch_10_42mm_aluminum_sport_band__light_blush_portrait.webp",
  "apple_watch_ultra_2_natural_alpine__dark_green_portrait.webp",
  "apple_watch_ultra_2_natural_alpine__navy_portrait.webp",
  "apple_watch_ultra_2_natural_alpine__tan_portrait.webp",
  "galaxy_s24_ultra__grey_landscape.webp",
  "galaxy_s24_ultra__grey_portrait.webp",
  "imac_24__blue_landscape.webp",
  "imac_24__green_landscape.webp",
  "imac_24__orange_landscape.webp",
  "imac_24__purple_landscape.webp",
  "imac_24__red_landscape.webp",
  "imac_24__silver_landscape.webp",
  "imac_24__yellow_landscape.webp",
  "ipad_air__gray_landscape.webp",
  "ipad_air__gray_portrait.webp",
  "ipad_mini__starlight_landscape.webp",
  "ipad_mini__starlight_portrait.webp",
  "ipad_pro_11_m4__silver_landscape.webp",
  "ipad_pro_11_m4__silver_portrait.webp",
  "ipad_pro_11_m4__space_gray_landscape.webp",
  "ipad_pro_11_m4__space_gray_portrait.webp",
  "ipad_pro_13_m4__silver_landscape.webp",
  "ipad_pro_13_m4__silver_portrait.webp",
  "ipad_pro_13_m4__space_gray_landscape.webp",
  "ipad_pro_13_m4__space_gray_portrait.webp",
  "iphone_17__black_landscape.webp",
  "iphone_17__black_portrait.webp",
  "iphone_17__lavender_landscape.webp",
  "iphone_17__lavender_portrait.webp",
  "iphone_17__mist_blue_landscape.webp",
  "iphone_17__mist_blue_portrait.webp",
  "iphone_17__sage_landscape.webp",
  "iphone_17__sage_portrait.webp",
  "iphone_17__white_landscape.webp",
  "iphone_17__white_portrait.webp",
  "iphone_17_pro__cosmic_orange_landscape.webp",
  "iphone_17_pro__cosmic_orange_portrait.webp",
  "iphone_17_pro__deep_blue_landscape.webp",
  "iphone_17_pro__deep_blue_portrait.webp",
  "iphone_17_pro__silver_landscape.webp",
  "iphone_17_pro__silver_portrait.webp",
  "iphone_17_pro_max__cosmic_orange_landscape.webp",
  "iphone_17_pro_max__cosmic_orange_portrait.webp",
  "iphone_17_pro_max__deep_blue_landscape.webp",
  "iphone_17_pro_max__deep_blue_portrait.webp",
  "iphone_17_pro_max__silver_landscape.webp",
  "iphone_17_pro_max__silver_portrait.webp",
  "macbook_air_13_gen_4__midnight_landscape.webp",
  "macbook_pro_14__5th_gen__silver_landscape.webp",
  "macbook_pro_16__5th_gen__silver_landscape.webp",
  "nothing_phone__black_landscape.webp",
  "nothing_phone__black_portrait.webp",
  "nothing_phone__white_landscape.webp",
  "nothing_phone__white_portrait.webp",
  "pixel_7__hazel_landscape.webp",
  "pixel_7__hazel_portrait.webp",
  "pixel_7__obsidian_landscape.webp",
  "pixel_7__obsidian_portrait.webp",
  "pixel_7__snow_landscape.webp",
  "pixel_7__snow_portrait.webp",
  "pro_display_xdr__silver_landscape.webp",
  "studio_display__silver_landscape.webp",
] as const

export const DEVICE_MOCKUP_ASSETS = DEVICE_MOCKUP_FILES.map((file) => {
  const { deviceId, color, orientation } = parseDeviceMockupFile(file)

  return {
    deviceId,
    deviceName: formatDeviceName(deviceId),
    color,
    orientation,
    file,
    src: getDeviceMockupSrc(file),
  }
}) satisfies DeviceMockupAsset[]

export const DEVICE_MOCKUPS = DEVICE_MOCKUP_ASSETS.reduce<DeviceMockup[]>(
  (devices, asset) => {
    let device = devices.find((item) => item.id === asset.deviceId)

    if (!device) {
      device = {
        id: asset.deviceId,
        name: asset.deviceName,
        thumbnailSrc: getDeviceMockupThumbnailSrc(asset.deviceId),
        colors: [],
        orientations: [],
        assets: [],
      }
      devices.push(device)
    }

    if (!device.colors.includes(asset.color)) device.colors.push(asset.color)
    if (!device.orientations.includes(asset.orientation)) {
      device.orientations.push(asset.orientation)
    }
    device.assets.push(asset)

    return devices
  },
  []
).map((device) => ({
  ...device,
  colors: device.colors.sort((a, b) => a.localeCompare(b)),
  orientations: device.orientations.sort(sortOrientations),
  assets: device.assets.sort((a, b) => a.file.localeCompare(b.file)),
}))

export function getDeviceMockup(deviceId: string) {
  return DEVICE_MOCKUPS.find((device) => device.id === deviceId)
}

export function getDeviceMockupAsset(
  deviceId: string,
  color: string,
  orientation: MockupOrientation
) {
  return DEVICE_MOCKUP_ASSETS.find(
    (asset) =>
      asset.deviceId === deviceId &&
      asset.color === color &&
      asset.orientation === orientation
  )
}

export function getDeviceMockupSrc(file: DeviceMockupFile) {
  return `${DEVICE_MOCKUPS_BASE_URL}/${file}`
}

/**
 * Decide the default "device" for the website-capture popover based on which
 * frame the user is currently using. Phones (iPhone/Galaxy/Pixel/Nothing Phone)
 * default to "mobile", iPads to "tablet", and laptops/desktops/displays/browser
 * frames to "desktop".
 *
 * Note: we intentionally do NOT key off `frame.orientation` — that is the
 * vertical/horizontal display toggle (and defaults to "vertical"), so using it
 * would misclassify a MacBook or iPad as a phone capture.
 */
export function defaultCaptureDeviceForFrame(frame: {
  id: string
  orientation: "vertical" | "horizontal"
}): "desktop" | "tablet" | "mobile" {
  const device = getDeviceMockup(frame.id)
  if (!device) return "desktop"
  if (/^(iphone|galaxy|pixel|nothing_phone)/i.test(device.id)) return "mobile"
  if (/^ipad/i.test(device.id)) return "tablet"
  return "desktop"
}

export function getDeviceMockupThumbnailSrc(deviceId: string) {
  return `${DEVICE_MOCKUP_THUMBNAILS_BASE_URL}/${deviceId}.webp`
}

function parseDeviceMockupFile(file: DeviceMockupFile) {
  const stem = file.replace(/\.webp$/, "")
  const separatorIndex = stem.lastIndexOf("__")
  const deviceId = stem.slice(0, separatorIndex)
  const variant = stem.slice(separatorIndex + 2)
  const orientation = variant.endsWith("_portrait") ? "portrait" : "landscape"
  const color = variant.replace(new RegExp(`_${orientation}$`), "")

  return { deviceId, color, orientation } as const
}

function formatDeviceName(deviceId: string) {
  return deviceId
    .replace(/__/g, "_")
    .split("_")
    .filter(Boolean)
    .map(formatDeviceNamePart)
    .join(" ")
}

function formatDeviceNamePart(part: string) {
  const special: Record<string, string> = {
    apple: "Apple",
    air: "Air",
    aluminum: "Aluminum",
    alpine: "Alpine",
    band: "Band",
    display: "Display",
    galaxy: "Galaxy",
    gen: "Gen",
    imac: "iMac",
    ipad: "iPad",
    iphone: "iPhone",
    macbook: "MacBook",
    max: "Max",
    mini: "Mini",
    natural: "Natural",
    nothing: "Nothing",
    phone: "Phone",
    pixel: "Pixel",
    pro: "Pro",
    s24: "S24",
    se: "SE",
    sport: "Sport",
    studio: "Studio",
    tv: "TV",
    ultra: "Ultra",
    watch: "Watch",
    xdr: "XDR",
  }

  return special[part] ?? part[0].toUpperCase() + part.slice(1)
}

function sortOrientations(a: MockupOrientation, b: MockupOrientation) {
  if (a === b) return 0
  return a === "portrait" ? -1 : 1
}

export const DEVICE_MOCKUP_SPECS: Record<
  string,
  {
    aspectRatio: string
    screen: {
      aspectRatio: string
      scale: number
      offsetX?: number
      offsetY?: number
      borderRadius: number
    }
  }
> = {
  apple_watch_10_42mm_aluminum_sport_band: {
    aspectRatio: "25 / 39",
    screen: {
      aspectRatio: "416 / 496",
      scale: 0.75188,
      borderRadius: 120,
    },
  },
  apple_watch_ultra_2_natural_alpine: {
    aspectRatio: "30 / 47",
    screen: {
      aspectRatio: "410 / 502",
      scale: 0.689655,
      borderRadius: 116,
    },
  },
  galaxy_s24_ultra: {
    aspectRatio: "1027 / 2097",
    screen: {
      aspectRatio: "384 / 824",
      scale: 0.921659,
      offsetX: -0.5,
      borderRadius: 0,
    },
  },
  galaxy_s25_ultra: {
    aspectRatio: "1027 / 2097",
    screen: {
      aspectRatio: "384 / 824",
      scale: 0.921659,
      offsetX: -0.5,
      borderRadius: 0,
    },
  },
  ipad_air: {
    aspectRatio: "932 / 1292",
    screen: {
      aspectRatio: "820 / 1180",
      scale: 0.884956,
      borderRadius: 16,
    },
  },
  ipad_mini: {
    aspectRatio: "744 / 1133",
    screen: {
      aspectRatio: "744 / 1180",
      scale: 0.869565,
      borderRadius: 18,
    },
  },
  ipad_pro_11_m4: {
    aspectRatio: "834 / 1210",
    screen: {
      aspectRatio: "834 / 1210",
      scale: 0.890472,
      borderRadius: 12,
    },
  },
  ipad_pro_13_m4: {
    aspectRatio: "1032 / 1376",
    screen: {
      aspectRatio: "1032 / 1376",
      scale: 0.9090909090909091,
      borderRadius: 0,
    },
  },
  iphone_17: {
    aspectRatio: "151 / 304",
    screen: {
      aspectRatio: "402 / 874",
      scale: 0.8890909090909091,
      borderRadius: 74,
    },
  },
  iphone_17_pro: {
    aspectRatio: "45 / 92",
    screen: {
      aspectRatio: "402 / 874",
      scale: 0.9090909090909091,
      borderRadius: 70,
    },
  },
  iphone_17_pro_max: {
    aspectRatio: "49 / 100",
    screen: {
      aspectRatio: "440 / 956",
      scale: 0.9090909090909091,
      borderRadius: 64,
    },
  },
  nothing_phone: {
    aspectRatio: "468 / 965",
    screen: {
      aspectRatio: "393 / 873",
      scale: 0.911577,
      borderRadius: 46,
    },
  },
  pixel_7: {
    aspectRatio: "468 / 965",
    screen: {
      aspectRatio: "412 / 892",
      scale: 0.9090909090909091,
      borderRadius: 24,
    },
  },
  macbook_air_13_gen_4: {
    aspectRatio: "1610 / 1050",
    screen: {
      aspectRatio: "1280 / 832",
      scale: 0.814912,
      borderRadius: 0,
    },
  },
  macbook_pro_14__5th_gen: {
    aspectRatio: "986 / 641",
    screen: {
      aspectRatio: "1512 / 982",
      scale: 0.778049,
      borderRadius: 0,
    },
  },
  macbook_pro_16__5th_gen: {
    aspectRatio: "217 / 143",
    screen: {
      aspectRatio: "1728 / 1117",
      scale: 0.813086,
      borderRadius: 0,
    },
  },
  imac_24: {
    aspectRatio: "27 / 23",
    screen: {
      aspectRatio: "1280 / 720",
      scale: 0.926061,
      offsetY: -25,
      borderRadius: 0,
    },
  },
  pro_display_xdr: {
    aspectRatio: "6316 / 4765",
    screen: {
      aspectRatio: "1920 / 1080",
      scale: 0.959251,
      offsetY: -15.9,
      borderRadius: 0,
    },
  },
  studio_display: {
    aspectRatio: "669 / 514",
    screen: {
      aspectRatio: "1920 / 1080",
      scale: 0.969251,
      offsetY: -17.3,
      borderRadius: 0,
    },
  },
}
