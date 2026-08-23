const SITE_URL = "https://tokokino.com"

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
})

const sessionSecurity = [{ sessionCookie: [] }]

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Tokokino API",
    version: "1.0.0",
    summary: "HTTP API for Tokokino screenshot shares, drafts, and presets.",
    description:
      "Tokokino is a browser-based screenshot and product-demo editor. Editing and export run entirely on the client; this API covers the server-backed features — public share links, cloud drafts, custom style presets, editor preferences, and a few media proxies used by the editor.\n\nAuthentication uses a better-auth session cookie. Sign in at /login, then send the session cookie with each request. See /auth.md for the full authentication guide.",
    contact: { name: "Tokokino", url: `${SITE_URL}/contact` },
    license: {
      name: "AGPL-3.0",
      url: "https://github.com/ShivaBhattacharjee/tokokino/blob/main/LICENSE",
    },
  },
  servers: [{ url: SITE_URL, description: "Production" }],
  externalDocs: {
    description: "Tokokino developer portal",
    url: `${SITE_URL}/developers`,
  },
  tags: [
    {
      name: "Shares",
      description: "Public share links for stills and videos.",
    },
    { name: "Drafts", description: "Cloud-saved editor state." },
    { name: "Presets", description: "Reusable custom style presets." },
    { name: "Preferences", description: "Per-user editor preferences." },
    {
      name: "Media",
      description: "Capture and media proxies used by the editor.",
    },
    { name: "Feedback", description: "Product feedback submissions." },
  ],
  paths: {
    "/api/share": {
      get: {
        tags: ["Shares"],
        operationId: "listShares",
        summary: "List the signed-in user's shares",
        security: sessionSecurity,
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            description: "Filter to still or animated shares.",
            schema: { type: "string", enum: ["style", "animate"] },
          },
        ],
        responses: {
          200: {
            description: "Shares and current storage usage.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["shares", "storage"],
                  properties: {
                    shares: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ShareSummary" },
                    },
                    storage: { $ref: "#/components/schemas/StorageUsage" },
                  },
                },
              },
            },
          },
          401: errorResponse("Not signed in."),
        },
      },
      post: {
        tags: ["Shares"],
        operationId: "createShare",
        summary: "Create a share link",
        description:
          "Send raw image bytes for a still share, or multipart/form-data with a `media` video part and an optional `poster` still for an animated share. Identical uploads are deduplicated per user and returned with `reused: true`.",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "image/png": {
              schema: { type: "string", format: "binary" },
            },
            "image/jpeg": {
              schema: { type: "string", format: "binary" },
            },
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["media"],
                properties: {
                  media: {
                    type: "string",
                    format: "binary",
                    description: "Video file for an animated share.",
                  },
                  poster: {
                    type: "string",
                    format: "binary",
                    description: "Optional PNG or JPEG gallery thumbnail.",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "The created (or reused) share.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreatedShare" },
              },
            },
          },
          400: errorResponse("Missing or unreadable file."),
          401: errorResponse("Not signed in."),
          413: errorResponse(
            "File exceeds the 40 MB share limit, or the 1 GB per-user storage quota."
          ),
          415: errorResponse("Unsupported media type."),
          429: errorResponse("Rate limited."),
        },
      },
      delete: {
        tags: ["Shares"],
        operationId: "deleteAllShares",
        summary: "Delete all of the user's shares",
        security: sessionSecurity,
        parameters: [
          {
            name: "type",
            in: "query",
            required: false,
            description: "Restrict the deletion to one share type.",
            schema: { type: "string", enum: ["style", "animate"] },
          },
        ],
        responses: {
          200: {
            description: "Deletion count.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok", "deleted"],
                  properties: {
                    ok: { type: "boolean" },
                    deleted: { type: "integer" },
                  },
                },
              },
            },
          },
          401: errorResponse("Not signed in."),
          500: errorResponse("Deletion failed."),
        },
      },
    },
    "/api/share/{id}": {
      parameters: [{ $ref: "#/components/parameters/ShareId" }],
      delete: {
        tags: ["Shares"],
        operationId: "deleteShare",
        summary: "Delete one share",
        security: sessionSecurity,
        responses: {
          200: {
            description: "Share deleted.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok"],
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
          400: errorResponse("Invalid share id."),
          401: errorResponse("Not signed in."),
          500: errorResponse("Deletion failed."),
        },
      },
    },
    "/api/share/{id}/image": {
      parameters: [{ $ref: "#/components/parameters/ShareId" }],
      get: {
        tags: ["Shares"],
        operationId: "getShareImage",
        summary: "Fetch a share's image bytes",
        description: "Public. No authentication required.",
        security: [],
        responses: {
          200: {
            description: "The share image.",
            content: {
              "image/png": { schema: { type: "string", format: "binary" } },
              "image/jpeg": { schema: { type: "string", format: "binary" } },
            },
          },
          404: errorResponse("No such share."),
        },
      },
    },
    "/api/share/{id}/poster": {
      parameters: [{ $ref: "#/components/parameters/ShareId" }],
      get: {
        tags: ["Shares"],
        operationId: "getSharePoster",
        summary: "Fetch an animated share's poster frame",
        security: [],
        responses: {
          200: {
            description: "The poster image.",
            content: {
              "image/png": { schema: { type: "string", format: "binary" } },
              "image/jpeg": { schema: { type: "string", format: "binary" } },
            },
          },
          404: errorResponse("No such share or poster."),
        },
      },
    },
    "/api/share/{id}/download": {
      parameters: [{ $ref: "#/components/parameters/ShareId" }],
      get: {
        tags: ["Shares"],
        operationId: "downloadShare",
        summary: "Download a share as an attachment",
        security: [],
        responses: {
          200: {
            description: "The share media with a Content-Disposition header.",
            content: {
              "application/octet-stream": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          404: errorResponse("No such share."),
        },
      },
    },
    "/api/share/uploads": {
      post: {
        tags: ["Shares"],
        operationId: "createShareUpload",
        summary: "Open a multipart upload for a video share",
        description:
          "Videos are far too large for a single Worker request body, so animated shares upload in 8 MB parts. Open the upload here, PUT each part, optionally PUT a poster frame, then POST to /complete.",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contentType", "sizeBytes"],
                properties: {
                  contentType: {
                    type: "string",
                    enum: ["video/mp4", "video/webm", "image/gif"],
                  },
                  sizeBytes: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "The opened upload, including the part size to use.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ShareUpload" },
              },
            },
          },
          400: errorResponse("Invalid media upload."),
          401: errorResponse("Not signed in."),
          413: errorResponse(
            "Storage limit reached, or file exceeds the 1 GB ceiling."
          ),
          429: errorResponse("Rate limited."),
          500: errorResponse("Could not start upload."),
        },
      },
      get: {
        tags: ["Shares"],
        operationId: "getShareUploadByQuery",
        summary: "Look up an upload by id",
        security: sessionSecurity,
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: {
            description: "Upload status.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ShareUpload" },
              },
            },
          },
          400: errorResponse("Invalid upload."),
          401: errorResponse("Not signed in."),
          404: errorResponse("Upload not found."),
        },
      },
    },
    "/api/share/uploads/{id}": {
      parameters: [{ $ref: "#/components/parameters/UploadId" }],
      get: {
        tags: ["Shares"],
        operationId: "getShareUpload",
        summary: "Read upload progress",
        security: sessionSecurity,
        responses: {
          200: {
            description: "Upload status, including confirmed bytes and parts.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ShareUpload" },
              },
            },
          },
          400: errorResponse("Invalid upload."),
          401: errorResponse("Not signed in."),
          404: errorResponse("Upload not found."),
          410: errorResponse("Upload expired."),
        },
      },
      delete: {
        tags: ["Shares"],
        operationId: "cancelShareUpload",
        summary: "Cancel an upload",
        security: sessionSecurity,
        responses: {
          200: {
            description: "Upload cancelled.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok"],
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
          400: errorResponse("Invalid upload."),
          401: errorResponse("Not signed in."),
          404: errorResponse("Upload not found."),
          409: errorResponse("Upload is no longer cancellable."),
        },
      },
    },
    "/api/share/uploads/{id}/parts/{partNumber}": {
      parameters: [
        { $ref: "#/components/parameters/UploadId" },
        {
          name: "partNumber",
          in: "path",
          required: true,
          description: "1-based part index.",
          schema: { type: "integer", minimum: 1 },
        },
      ],
      put: {
        tags: ["Shares"],
        operationId: "uploadSharePart",
        summary: "Upload one 8 MB part",
        description:
          "Re-sending a part already stored is safe and answers with `duplicate: true`.",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "application/octet-stream": {
              schema: { type: "string", format: "binary" },
            },
          },
        },
        responses: {
          200: {
            description: "Part stored.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok", "confirmedBytes"],
                  properties: {
                    ok: { type: "boolean" },
                    confirmedBytes: { type: "integer" },
                    duplicate: { type: "boolean" },
                  },
                },
              },
            },
          },
          400: errorResponse("Invalid part range, size, or body."),
          401: errorResponse("Not signed in."),
          404: errorResponse("Upload not found."),
          409: errorResponse("Upload is not active."),
          415: errorResponse("Unsupported part content type."),
          502: errorResponse("Storage upstream failure."),
        },
      },
    },
    "/api/share/uploads/{id}/poster": {
      parameters: [{ $ref: "#/components/parameters/UploadId" }],
      put: {
        tags: ["Shares"],
        operationId: "uploadSharePoster",
        summary: "Attach a poster frame to the upload",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "image/png": { schema: { type: "string", format: "binary" } },
            "image/jpeg": { schema: { type: "string", format: "binary" } },
          },
        },
        responses: {
          200: {
            description: "Poster stored.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok"],
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
          400: errorResponse("Invalid upload or poster."),
          401: errorResponse("Not signed in."),
          404: errorResponse("Upload not found."),
          502: errorResponse("Storage upstream failure."),
        },
      },
    },
    "/api/share/uploads/{id}/complete": {
      parameters: [{ $ref: "#/components/parameters/UploadId" }],
      post: {
        tags: ["Shares"],
        operationId: "completeShareUpload",
        summary: "Finalise the upload into a share",
        security: sessionSecurity,
        responses: {
          200: {
            description: "The created share.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["id", "url"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    url: { type: "string", format: "uri" },
                  },
                },
              },
            },
          },
          401: errorResponse("Not signed in."),
          404: errorResponse("Upload not found."),
          409: errorResponse("Upload is incomplete or was cancelled."),
          410: errorResponse("Upload expired."),
          502: errorResponse("Could not complete upload."),
        },
      },
    },
    "/api/drafts": {
      get: {
        tags: ["Drafts"],
        operationId: "listDrafts",
        summary: "List saved drafts",
        security: sessionSecurity,
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer" },
            description: "Page size.",
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer" },
            description: "Page offset.",
          },
          {
            name: "sort",
            in: "query",
            schema: { type: "string" },
            description: "Sort order for the listing.",
          },
          {
            name: "type",
            in: "query",
            schema: { type: "string", enum: ["style", "animate"] },
            description: "Filter by draft type.",
          },
          {
            name: "q",
            in: "query",
            schema: { type: "string" },
            description: "Typo-tolerant name search.",
          },
        ],
        responses: {
          200: {
            description: "Draft summaries and storage usage.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["drafts"],
                  properties: {
                    drafts: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DraftSummary" },
                    },
                    total: { type: "integer" },
                    storage: { $ref: "#/components/schemas/StorageUsage" },
                  },
                },
              },
            },
          },
          401: errorResponse("Not signed in."),
        },
      },
      post: {
        tags: ["Drafts"],
        operationId: "createDraft",
        summary: "Save a new draft",
        description:
          "The draft body carries the full editor state. Bodies are capped at 15 MB.",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DraftWriteBody" },
            },
          },
        },
        responses: {
          200: {
            description: "The saved draft.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["draft"],
                  properties: {
                    draft: { $ref: "#/components/schemas/DraftSummary" },
                  },
                },
              },
            },
          },
          400: errorResponse("Invalid body."),
          401: errorResponse("Not signed in."),
          413: errorResponse("Draft exceeds the size cap."),
          500: errorResponse("Could not save draft."),
        },
      },
    },
    "/api/drafts/{id}": {
      parameters: [{ $ref: "#/components/parameters/DraftId" }],
      get: {
        tags: ["Drafts"],
        operationId: "getDraft",
        summary: "Fetch one draft with its full state",
        security: sessionSecurity,
        responses: {
          200: {
            description: "The draft.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          401: errorResponse("Not signed in."),
          404: errorResponse("Draft not found."),
        },
      },
      put: {
        tags: ["Drafts"],
        operationId: "replaceDraft",
        summary: "Replace a draft's state",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DraftWriteBody" },
            },
          },
        },
        responses: {
          200: {
            description: "The updated draft.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          400: errorResponse("Invalid body."),
          401: errorResponse("Not signed in."),
          404: errorResponse("Draft not found."),
        },
      },
      patch: {
        tags: ["Drafts"],
        operationId: "renameDraft",
        summary: "Rename a draft",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", maxLength: 80 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "The renamed draft.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          400: errorResponse("Name is required."),
          401: errorResponse("Not signed in."),
          404: errorResponse("Draft not found."),
        },
      },
      delete: {
        tags: ["Drafts"],
        operationId: "deleteDraft",
        summary: "Delete a draft",
        security: sessionSecurity,
        responses: {
          200: {
            description: "Draft deleted.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          401: errorResponse("Not signed in."),
          404: errorResponse("Draft not found."),
        },
      },
    },
    "/api/drafts/{id}/thumb": {
      parameters: [{ $ref: "#/components/parameters/DraftId" }],
      get: {
        tags: ["Drafts"],
        operationId: "getDraftThumbnail",
        summary: "Fetch a draft thumbnail",
        security: sessionSecurity,
        responses: {
          200: {
            description: "The thumbnail image.",
            content: {
              "image/png": { schema: { type: "string", format: "binary" } },
              "image/jpeg": { schema: { type: "string", format: "binary" } },
            },
          },
          401: errorResponse("Not signed in."),
          404: errorResponse("Draft or thumbnail not found."),
        },
      },
      post: {
        tags: ["Drafts"],
        operationId: "putDraftThumbnail",
        summary: "Upload a draft thumbnail",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "image/png": { schema: { type: "string", format: "binary" } },
            "image/jpeg": { schema: { type: "string", format: "binary" } },
          },
        },
        responses: {
          200: {
            description: "Thumbnail stored.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          400: errorResponse("Missing image."),
          401: errorResponse("Not signed in."),
          404: errorResponse("Draft not found."),
        },
      },
    },
    "/api/presets": {
      get: {
        tags: ["Presets"],
        operationId: "listPresets",
        summary: "List custom presets",
        security: sessionSecurity,
        parameters: [
          {
            name: "sort",
            in: "query",
            schema: { type: "string" },
            description: "Sort order for the listing.",
          },
        ],
        responses: {
          200: {
            description: "The user's presets.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["presets"],
                  properties: {
                    presets: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Preset" },
                    },
                  },
                },
              },
            },
          },
          401: errorResponse("Not signed in."),
        },
      },
      post: {
        tags: ["Presets"],
        operationId: "createPreset",
        summary: "Create a custom preset",
        description: "Preset bodies are capped at 1 MB.",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PresetWriteBody" },
            },
          },
        },
        responses: {
          200: {
            description: "The saved preset.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["preset"],
                  properties: {
                    preset: { $ref: "#/components/schemas/Preset" },
                  },
                },
              },
            },
          },
          400: errorResponse("Invalid body."),
          401: errorResponse("Not signed in."),
          413: errorResponse("Preset exceeds the size cap."),
          500: errorResponse("Could not save preset."),
        },
      },
    },
    "/api/presets/{id}": {
      parameters: [{ $ref: "#/components/parameters/PresetId" }],
      put: {
        tags: ["Presets"],
        operationId: "updatePreset",
        summary: "Update a preset",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PresetWriteBody" },
            },
          },
        },
        responses: {
          200: {
            description: "The updated preset.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          400: errorResponse("Invalid body."),
          401: errorResponse("Not signed in."),
          404: errorResponse("Preset not found."),
        },
      },
      delete: {
        tags: ["Presets"],
        operationId: "deletePreset",
        summary: "Delete a preset",
        security: sessionSecurity,
        responses: {
          200: {
            description: "Preset deleted.",
            content: { "application/json": { schema: { type: "object" } } },
          },
          401: errorResponse("Not signed in."),
          404: errorResponse("Preset not found."),
        },
      },
    },
    "/api/preferences": {
      get: {
        tags: ["Preferences"],
        operationId: "getPreferences",
        summary: "Read editor preferences",
        security: sessionSecurity,
        responses: {
          200: {
            description: "The user's preferences.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Preferences" },
              },
            },
          },
          401: errorResponse("Not signed in."),
        },
      },
      put: {
        tags: ["Preferences"],
        operationId: "updatePreferences",
        summary: "Update editor preferences",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Preferences" },
            },
          },
        },
        responses: {
          200: {
            description: "The updated preferences.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Preferences" },
              },
            },
          },
          400: errorResponse("Invalid body."),
          401: errorResponse("Not signed in."),
        },
      },
    },
    "/api/screenshot": {
      post: {
        tags: ["Media"],
        operationId: "captureUrl",
        summary: "Capture a screenshot of a public URL",
        description:
          "Renders the URL with Cloudflare Browser Rendering and returns the capture. Rate limited.",
        security: sessionSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url", "width", "aspectRatio"],
                properties: {
                  url: { type: "string", format: "uri" },
                  device: {
                    type: "string",
                    enum: ["desktop", "tablet", "mobile"],
                    default: "desktop",
                  },
                  width: { type: "integer", minimum: 320, maximum: 3840 },
                  aspectRatio: { type: "string" },
                  delay: {
                    type: "string",
                    enum: ["none", "2s", "5s"],
                    default: "none",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "The capture." },
          400: errorResponse("Invalid capture request."),
          429: errorResponse("Rate limited."),
          503: errorResponse("Browser rendering unavailable."),
        },
      },
    },
    "/api/tweet": {
      get: {
        tags: ["Media"],
        operationId: "getPost",
        summary: "Fetch an X or Bluesky post for a mockup",
        security: [],
        parameters: [
          {
            name: "url",
            in: "query",
            required: true,
            description: "Public X (Twitter) or Bluesky post URL.",
            schema: { type: "string", format: "uri" },
          },
        ],
        responses: {
          200: {
            description: "The post card.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["tweet"],
                  properties: { tweet: { type: "object" } },
                },
              },
            },
          },
          400: errorResponse("Invalid X or Bluesky post link."),
          404: errorResponse("Post not found."),
          429: errorResponse("Rate limited."),
          502: errorResponse("Upstream failure."),
          504: errorResponse("Upstream timed out."),
        },
      },
    },
    "/api/unsplash/search": {
      get: {
        tags: ["Media"],
        operationId: "searchUnsplash",
        summary: "Search Unsplash backgrounds",
        security: [],
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "page",
            in: "query",
            required: false,
            schema: { type: "integer", minimum: 1, default: 1 },
          },
        ],
        responses: {
          200: {
            description: "Search results.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["page", "hasMore", "results"],
                  properties: {
                    page: { type: "integer" },
                    hasMore: { type: "boolean" },
                    results: {
                      type: "array",
                      items: { $ref: "#/components/schemas/UnsplashPhoto" },
                    },
                  },
                },
              },
            },
          },
          400: errorResponse("Missing search query."),
          429: errorResponse("Rate limited."),
          502: errorResponse("Unsplash upstream failure."),
        },
      },
    },
    "/api/unsplash/download": {
      get: {
        tags: ["Media"],
        operationId: "trackUnsplashDownload",
        summary: "Register an Unsplash download",
        description:
          "Pings the Unsplash download endpoint, as their API guidelines require.",
        security: [],
        parameters: [
          {
            name: "url",
            in: "query",
            required: true,
            description: "The `downloadLocation` from a search result.",
            schema: { type: "string", format: "uri" },
          },
        ],
        responses: {
          200: { description: "Download registered." },
          400: errorResponse("Missing Unsplash download location."),
        },
      },
    },
    "/api/export/image": {
      get: {
        tags: ["Media"],
        operationId: "proxyImage",
        summary: "CORS proxy for external images used during export",
        security: [],
        parameters: [
          {
            name: "url",
            in: "query",
            required: true,
            description: "Absolute URL of the image to proxy.",
            schema: { type: "string", format: "uri" },
          },
        ],
        responses: {
          200: {
            description: "The proxied image.",
            content: {
              "image/*": { schema: { type: "string", format: "binary" } },
            },
          },
          400: errorResponse("Invalid or blocked image URL."),
          413: errorResponse("Image is too large."),
          415: errorResponse("Not an image."),
          504: errorResponse("Upstream timed out."),
        },
      },
    },
    "/api/feedback": {
      post: {
        tags: ["Feedback"],
        operationId: "submitFeedback",
        summary: "Submit product feedback",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  rating: { type: "integer", minimum: 1, maximum: 5 },
                  message: { type: "string", maxLength: 2000 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Feedback recorded.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ok"],
                  properties: { ok: { type: "boolean" } },
                },
              },
            },
          },
          400: errorResponse("Invalid feedback."),
          429: errorResponse("Rate limited."),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description: `Session cookie issued by better-auth. Sign in at ${SITE_URL}/login (email/password or Google OAuth). Full guide at ${SITE_URL}/auth.md.`,
      },
    },
    parameters: {
      ShareId: {
        name: "id",
        in: "path",
        required: true,
        description: "Share UUID.",
        schema: { type: "string", format: "uuid" },
      },
      DraftId: {
        name: "id",
        in: "path",
        required: true,
        description: "Draft UUID.",
        schema: { type: "string", format: "uuid" },
      },
      UploadId: {
        name: "id",
        in: "path",
        required: true,
        description: "Share upload UUID.",
        schema: { type: "string", format: "uuid" },
      },
      PresetId: {
        name: "id",
        in: "path",
        required: true,
        description: "Preset UUID.",
        schema: { type: "string", format: "uuid" },
      },
    },
    schemas: {
      Error: {
        type: "object",
        description:
          "Every JSON error uses this shape. `error` repeats `message` for backward compatibility with existing clients.",
        required: ["error", "code", "message"],
        properties: {
          error: { type: "string", description: "Human-readable message." },
          code: {
            type: "string",
            description: "Stable, machine-readable error code.",
            enum: [
              "unauthorized",
              "forbidden",
              "not_found",
              "invalid_request",
              "unsupported_media_type",
              "payload_too_large",
              "rate_limited",
              "internal_error",
            ],
          },
          message: { type: "string" },
          hint: {
            type: "string",
            description: "How to resolve the error.",
          },
          docs: { type: "string", format: "uri" },
        },
      },
      StorageUsage: {
        type: "object",
        required: ["used", "limit"],
        properties: {
          used: { type: "integer", description: "Bytes used." },
          limit: { type: "integer", description: "Bytes allowed." },
        },
      },
      ShareSummary: {
        type: "object",
        required: ["id", "imageUrl", "viewCount"],
        properties: {
          id: { type: "string", format: "uuid" },
          imageUrl: { type: "string", format: "uri" },
          posterUrl: { type: ["string", "null"], format: "uri" },
          viewCount: { type: "integer" },
          sizeBytes: { type: "integer" },
          type: { type: "string", enum: ["style", "animate"] },
          contentType: { type: "string" },
          createdAt: { type: "string" },
        },
      },
      CreatedShare: {
        type: "object",
        required: ["id", "url", "imageUrl"],
        properties: {
          id: { type: "string", format: "uuid" },
          url: { type: "string", format: "uri" },
          imageUrl: { type: "string", format: "uri" },
          posterUrl: { type: ["string", "null"], format: "uri" },
          type: { type: "string", enum: ["style", "animate"] },
          contentType: { type: "string" },
          views: { type: "integer" },
          reused: {
            type: "boolean",
            description: "True when an identical upload was deduplicated.",
          },
          storage: { $ref: "#/components/schemas/StorageUsage" },
        },
      },
      ShareUpload: {
        type: "object",
        required: ["id", "shareId", "status", "sizeBytes", "confirmedBytes"],
        properties: {
          id: { type: "string", format: "uuid" },
          shareId: { type: "string", format: "uuid" },
          status: { type: "string" },
          contentType: { type: "string" },
          sizeBytes: { type: "integer" },
          confirmedBytes: { type: "integer" },
          parts: { type: "array", items: { type: "integer" } },
          partSize: {
            type: "integer",
            description: "Bytes per part. Only present when opening an upload.",
          },
          expiresAt: { type: "string", format: "date-time" },
          url: { type: ["string", "null"] },
        },
      },
      DraftSummary: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", maxLength: 80 },
          canvasCount: { type: "integer" },
          byteSize: { type: "integer" },
          type: { type: "string", enum: ["style", "animate"] },
          createdAt: { type: "string" },
        },
      },
      DraftWriteBody: {
        type: "object",
        required: ["name", "state"],
        properties: {
          name: { type: "string", maxLength: 80 },
          state: {
            type: "object",
            description:
              "Full editor state. Either the `{ schemaVersion, present, ui }` envelope or a bare legacy EditorState.",
          },
        },
      },
      Preset: {
        type: "object",
        required: ["id", "name"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", maxLength: 60 },
          slotCount: { type: "integer" },
          type: { type: "string", enum: ["style", "animate"] },
          geometry: { type: "object" },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
        },
      },
      PresetWriteBody: {
        type: "object",
        required: ["name", "geometry"],
        properties: {
          name: { type: "string", maxLength: 60 },
          type: { type: "string", enum: ["style", "animate"] },
          geometry: {
            type: "object",
            description:
              "Layout geometry plus a canvas-style snapshot. Animate presets also carry `animation`.",
          },
        },
      },
      Preferences: {
        type: "object",
        properties: {
          exportFilenameFormat: { type: "string" },
        },
      },
      UnsplashPhoto: {
        type: "object",
        required: ["id", "thumb", "full"],
        properties: {
          id: { type: "string" },
          alt: { type: "string" },
          thumb: { type: "string", format: "uri" },
          full: { type: "string", format: "uri" },
          downloadLocation: { type: "string", format: "uri" },
          photographer: { type: "string" },
          photographerUrl: { type: "string", format: "uri" },
        },
      },
    },
  },
} as const
