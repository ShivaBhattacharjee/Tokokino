#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS_DIR="${ROOT_DIR}/public/assets"
BACKGROUNDS_JSON="${ROOT_DIR}/lib/editor/backgrounds-data.json"

resolve_r2_base() {
  if [[ -n "${NEXT_PUBLIC_R2_PUBLIC_BASE:-}" ]]; then
    echo "${NEXT_PUBLIC_R2_PUBLIC_BASE}"
    return 0
  fi

  if [[ ! -f "${BACKGROUNDS_JSON}" ]]; then
    echo "https://assets.tokokino.com"
    return 0
  fi

  node -e '
    const fs = require("node:fs")
    const path = process.argv[1]
    const raw = fs.readFileSync(path, "utf8")
    const data = JSON.parse(raw)
    const first = data?.[0]?.items?.[0]?.full
    if (!first) throw new Error("No background URL found")
    const origin = new URL(first).origin
    process.stdout.write(origin)
  ' "${BACKGROUNDS_JSON}" 2>/dev/null || echo "https://assets.tokokino.com"
}

R2_BASE="$(resolve_r2_base)"

OVERLAY_DIR="${ASSETS_DIR}/overlays/thumbs"
DEVICE_DIR="${ASSETS_DIR}/device-mockups"
DEVICE_THUMB_DIR="${DEVICE_DIR}/thumbnails"

mkdir -p "${OVERLAY_DIR}" "${DEVICE_DIR}" "${DEVICE_THUMB_DIR}"

echo "Using R2 base: ${R2_BASE}"
echo "Saving assets under: ${ASSETS_DIR}"

download_file() {
  local url="$1"
  local out="$2"
  if [[ -f "${out}" ]]; then
    echo "skip ${out}"
    return 0
  fi
  curl -fsSL "${url}" -o "${out}"
  echo "ok   ${out}"
}

echo ""
echo "Downloading overlay thumbnails (001..100)..."
for i in $(seq 1 100); do
  file_id="$(printf "%03d" "${i}")"
  download_file \
    "${R2_BASE}/overlays/thumbs/${file_id}.webp" \
    "${OVERLAY_DIR}/${file_id}.webp"
done

echo ""
echo "Downloading device mockup thumbnails..."
device_ids=(
  "apple_watch_10_42mm_aluminum_sport_band"
  "apple_watch_ultra_2_natural_alpine"
  "galaxy_s24_ultra"
  "imac_24"
  "ipad_air"
  "ipad_mini"
  "ipad_pro_11_m4"
  "ipad_pro_13_m4"
  "iphone_17"
  "iphone_17_pro"
  "iphone_17_pro_max"
  "macbook_air_13_gen_4"
  "macbook_pro_14__5th_gen"
  "macbook_pro_16__5th_gen"
  "nothing_phone"
  "pixel_7"
  "pro_display_xdr"
  "studio_display"
)
for id in "${device_ids[@]}"; do
  download_file \
    "${R2_BASE}/Device-Mockups/device-mockups/thumbnails/${id}.webp" \
    "${DEVICE_THUMB_DIR}/${id}.webp"
done

echo ""
echo "Downloading device mockup files..."
mockup_files=(
  "apple_watch_10_42mm_aluminum_sport_band__black_portrait.webp"
  "apple_watch_10_42mm_aluminum_sport_band__light_blush_portrait.webp"
  "apple_watch_ultra_2_natural_alpine__dark_green_portrait.webp"
  "apple_watch_ultra_2_natural_alpine__navy_portrait.webp"
  "apple_watch_ultra_2_natural_alpine__tan_portrait.webp"
  "galaxy_s24_ultra__grey_landscape.webp"
  "galaxy_s24_ultra__grey_portrait.webp"
  "imac_24__blue_landscape.webp"
  "imac_24__green_landscape.webp"
  "imac_24__orange_landscape.webp"
  "imac_24__purple_landscape.webp"
  "imac_24__red_landscape.webp"
  "imac_24__silver_landscape.webp"
  "imac_24__yellow_landscape.webp"
  "ipad_air__gray_landscape.webp"
  "ipad_air__gray_portrait.webp"
  "ipad_mini__starlight_landscape.webp"
  "ipad_mini__starlight_portrait.webp"
  "ipad_pro_11_m4__silver_landscape.webp"
  "ipad_pro_11_m4__silver_portrait.webp"
  "ipad_pro_11_m4__space_gray_landscape.webp"
  "ipad_pro_11_m4__space_gray_portrait.webp"
  "ipad_pro_13_m4__silver_landscape.webp"
  "ipad_pro_13_m4__silver_portrait.webp"
  "ipad_pro_13_m4__space_gray_landscape.webp"
  "ipad_pro_13_m4__space_gray_portrait.webp"
  "iphone_17__black_landscape.webp"
  "iphone_17__black_portrait.webp"
  "iphone_17__lavender_landscape.webp"
  "iphone_17__lavender_portrait.webp"
  "iphone_17__mist_blue_landscape.webp"
  "iphone_17__mist_blue_portrait.webp"
  "iphone_17__sage_landscape.webp"
  "iphone_17__sage_portrait.webp"
  "iphone_17__white_landscape.webp"
  "iphone_17__white_portrait.webp"
  "iphone_17_pro__cosmic_orange_landscape.webp"
  "iphone_17_pro__cosmic_orange_portrait.webp"
  "iphone_17_pro__deep_blue_landscape.webp"
  "iphone_17_pro__deep_blue_portrait.webp"
  "iphone_17_pro__silver_landscape.webp"
  "iphone_17_pro__silver_portrait.webp"
  "iphone_17_pro_max__cosmic_orange_landscape.webp"
  "iphone_17_pro_max__cosmic_orange_portrait.webp"
  "iphone_17_pro_max__deep_blue_landscape.webp"
  "iphone_17_pro_max__deep_blue_portrait.webp"
  "iphone_17_pro_max__silver_landscape.webp"
  "iphone_17_pro_max__silver_portrait.webp"
  "macbook_air_13_gen_4__midnight_landscape.webp"
  "macbook_pro_14__5th_gen__silver_landscape.webp"
  "macbook_pro_16__5th_gen__silver_landscape.webp"
  "nothing_phone__black_landscape.webp"
  "nothing_phone__black_portrait.webp"
  "nothing_phone__white_landscape.webp"
  "nothing_phone__white_portrait.webp"
  "pixel_7__hazel_landscape.webp"
  "pixel_7__hazel_portrait.webp"
  "pixel_7__obsidian_landscape.webp"
  "pixel_7__obsidian_portrait.webp"
  "pixel_7__snow_landscape.webp"
  "pixel_7__snow_portrait.webp"
  "pro_display_xdr__silver_landscape.webp"
  "studio_display__silver_landscape.webp"
)
for file in "${mockup_files[@]}"; do
  download_file \
    "${R2_BASE}/Device-Mockups/device-mockups/${file}" \
    "${DEVICE_DIR}/${file}"
done

echo ""
echo "Asset installation complete."
