# share

Create and retrieve public share links for beautified screenshots.

## Endpoints

- `POST /api/share` — Upload a screenshot blob and receive a public share URL
- `GET /api/share/{id}` — Retrieve share metadata
- `GET /api/share/{id}/image` — Retrieve the share image

## Authentication

Session cookie required. See [auth.md](https://tokokino.com/auth.md).

## Request

```
POST /api/share
Content-Type: image/png
Authorization: session cookie
Body: raw PNG or JPEG blob (max 20 MB)
```

## Response

```json
{ "id": "uuid", "url": "https://tokokino.com/share/uuid", "imageUrl": "...", "views": 0, "reused": false }
```
