# drafts

Save and restore editor state as named drafts.

## Endpoints

- `GET /api/drafts` — List all drafts for the authenticated user
- `POST /api/drafts` — Create a new draft
- `GET /api/drafts/{id}` — Retrieve a draft
- `PUT /api/drafts/{id}` — Update a draft
- `DELETE /api/drafts/{id}` — Delete a draft
- `GET /api/drafts/{id}/thumb` — Retrieve draft thumbnail

## Authentication

Personal access token (`Authorization: Bearer tk_…`) or session cookie. See [auth.md](https://tokokino.com/auth.md).
