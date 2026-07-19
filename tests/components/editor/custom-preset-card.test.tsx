import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PresetCardsBody } from "@/components/editor/present-presets-section/cards"
import { createCanvas } from "@/lib/editor/store/defaults"
import type { AspectState, CustomPresetSummary } from "@/lib/editor/store"

// The card renders a full <CanvasView> preview, which is far too heavy (and
// store-dependent) for a unit test. Stub it — the menu / rename / delete
// behaviour under test doesn't depend on the preview pixels.
vi.mock("@/components/editor/canvas", () => ({
  CanvasView: () => null,
}))

const ASPECT: AspectState = { id: "16-10", w: 16, h: 10 }

const PRESET: CustomPresetSummary = {
  id: "preset_1",
  name: "Brave Coffee Hamster",
  slotCount: 1,
  type: "style",
  geometry: {
    canvasTilt: { rx: 0, ry: 0, rz: 0 },
    canvasScale: 100,
    slots: [],
  },
}

function renderCards(
  overrides: Partial<React.ComponentProps<typeof PresetCardsBody>> = {}
) {
  const onRenameCustom = vi.fn()
  const onDeleteCustom = vi.fn()
  render(
    <PresetCardsBody
      displayTab="custom"
      horizontal={false}
      activeSinglePresetId={null}
      activeLayoutPresetId={null}
      activeCustomPresetId={null}
      customPresets={[PRESET]}
      customPresetsLoading={false}
      customPresetsLoaded
      isAuthPending={false}
      userId="user_1"
      canvas={createCanvas("canvas")}
      aspect={ASPECT}
      onApplySingle={vi.fn()}
      onApplyLayout={vi.fn()}
      onApplyCustom={vi.fn()}
      onDeleteCustom={onDeleteCustom}
      onRenameCustom={onRenameCustom}
      {...overrides}
    />
  )
  return { onRenameCustom, onDeleteCustom }
}

afterEach(() => vi.clearAllMocks())

describe("CustomPresetCard — options menu", () => {
  it("renders an always-visible options button", () => {
    renderCards()
    expect(
      screen.getByRole("button", {
        name: "Preset options for Brave Coffee Hamster",
      })
    ).toBeInTheDocument()
  })

  it("exposes Rename and Delete in the menu", async () => {
    renderCards()
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", {
        name: "Preset options for Brave Coffee Hamster",
      })
    )
    expect(
      await screen.findByRole("menuitem", { name: "Rename" })
    ).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument()
  })

  it("renames with a pre-filled dialog and reports the trimmed name", async () => {
    const { onRenameCustom } = renderCards()
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", {
        name: "Preset options for Brave Coffee Hamster",
      })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Rename preset")).toBeInTheDocument()
    const input = within(dialog).getByRole<HTMLInputElement>("textbox")
    expect(input.value).toBe("Brave Coffee Hamster")
    // Confirm is disabled until the name actually changes.
    expect(
      within(dialog).getByRole("button", { name: "Rename" })
    ).toBeDisabled()

    await user.clear(input)
    await user.type(input, "  Calm Coffee Hamster  ")
    await user.click(within(dialog).getByRole("button", { name: "Rename" }))

    expect(onRenameCustom).toHaveBeenCalledWith(
      "preset_1",
      "Calm Coffee Hamster"
    )
  })

  it("confirms before deleting and reports the preset id", async () => {
    const { onDeleteCustom } = renderCards()
    const user = userEvent.setup()
    await user.click(
      screen.getByRole("button", {
        name: "Preset options for Brave Coffee Hamster",
      })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }))

    const alert = await screen.findByRole("alertdialog")
    expect(within(alert).getByText("Delete preset?")).toBeInTheDocument()
    await user.click(within(alert).getByRole("button", { name: "Delete" }))

    expect(onDeleteCustom).toHaveBeenCalledWith("preset_1")
  })
})
