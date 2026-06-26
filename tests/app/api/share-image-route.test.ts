import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getShareImage: vi.fn(),
}))

vi.mock("@/lib/share-storage", () => ({
  getShareImage: mocks.getShareImage,
}))

const VALID_SHARE_ID = "123e4567-e89b-42d3-a456-426614174000"

async function loadRoute() {
  return import("@/app/api/share/[id]/image/route")
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function streamFor(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

describe("GET /api/share/[id]/image", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rejects malformed share ids without reading storage", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      new Request("http://localhost:3000"),
      params("bad-id")
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid share link",
    })
    expect(mocks.getShareImage).not.toHaveBeenCalled()
  })

  it("returns a cacheable image stream for valid share images", async () => {
    const bytes = new Uint8Array([9, 8, 7])
    mocks.getShareImage.mockResolvedValue({
      Body: { transformToWebStream: () => streamFor(bytes) },
      ContentType: "image/jpeg",
    })
    const { GET } = await loadRoute()

    const response = await GET(
      new Request("http://localhost:3000"),
      params(VALID_SHARE_ID)
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/jpeg")
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="tokokino-share-${VALID_SHARE_ID}.png"`
    )
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  })

  it("returns 404 when storage has no readable body", async () => {
    mocks.getShareImage.mockResolvedValue({ Body: null })
    const { GET } = await loadRoute()

    const response = await GET(
      new Request("http://localhost:3000"),
      params(VALID_SHARE_ID)
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: "Share image not found",
    })
  })
})
