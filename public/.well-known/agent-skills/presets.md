# presets

Manage custom style presets for the screenshot editor.

## Endpoints

- `GET /api/presets` — List custom presets for the authenticated user
- `POST /api/presets` — Create a new preset
- `PUT /api/presets/{id}` — Update a preset
- `DELETE /api/presets/{id}` — Delete a preset

## Authentication

Personal access token (`Authorization: Bearer tk_…`) or session cookie. See [auth.md](https://tokokino.com/auth.md).
