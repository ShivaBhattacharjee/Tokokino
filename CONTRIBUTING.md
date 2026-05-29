# Contributing to Tokokino

Thanks for contributing to Tokokino. This guide keeps contribution flow consistent with the current Cloudflare/OpenNext setup and editor architecture.

## Project overview

Tokokino is a client-heavy Next.js app for creating screenshot compositions. Most editor logic runs in-browser with Zustand. Server routes mainly cover auth, sharing, metadata, and image/screenshot APIs.

## Tech stack

- Framework: Next.js `15.5.18` + React `19.2.x` + TypeScript `5.9.x`
- Styling/UI: Tailwind CSS v4, shadcn/ui, Radix UI, motion
- State: Zustand
- Validation: Zod v4 (`zod/v4`)
- Auth: better-auth
- Data: Cloudflare D1 (`TOKOKINO_DB`)
- Object storage: Cloudflare R2 (AWS S3 SDK)
- Tooling: ESLint, Prettier, Husky, lint-staged, pnpm, Wrangler

## Local setup

1. Fork the repo and clone your fork.
2. Install dependencies:

```bash
pnpm install
```

3. Create your environment file:

```bash
# then set variables manually
touch .env.local
```

4. Start development:

```bash
pnpm dev
```

## Environment variables

Configured/validated in `lib/env.ts`.

Commonly required:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `R2_BUCKET`
- `R2_S3_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Optional integrations:

- `UNSPLASH_ACCESS_KEY`
- `GOOGLE_CLIENT_ID` (optional)
- `GOOGLE_CLIENT_SECRET` (optional)
- `CLOUDFLARE_ACCOUNT_ID` (for browser screenshot API)
- `CLOUDFLARE_BROWSER_API_TOKEN` (for browser screenshot API)
- `NEXT_PUBLIC_ENABLE_DEBUG_PRESETS=true` (optional)

## Contribution workflow

1. Create a branch from `main`:

```bash
git checkout -b codex/fix-short-description
```

2. Make focused changes.
3. Run checks before opening PR:

```bash
pnpm typecheck
pnpm lint
```

4. Commit using this repository style:

- `fix: commmit`
- `refactor: <short short-message>`
- `delete: <short short-message>`
- `optimised: <short short-message>`

Keep commit messages short and direct.

5. Push branch and open a Pull Request.

## Pull request guidelines

- Keep PRs small and focused.
- Explain what changed and why.
- Link related issues.
- Add screenshots/GIFs for UI changes.
- Mention breaking changes clearly.
- Confirm `pnpm typecheck` and lint pass locally.

Use the PR template at `.github/pull_request_template.md`.

## Issues

Use the templates in `.github/ISSUE_TEMPLATE/`:

- Bug report
- Feature request
- General issue/task

Good issues include:

- Clear reproduction steps
- Expected vs actual behavior
- Environment details (browser/OS/version)
- Screenshots or recordings if relevant

## Implementation notes

- Use selectors with Zustand; avoid subscribing to the whole store in components.
- For numeric editor inputs, use existing helpers in `lib/editor/value-schemas.ts`.
- Keep export-safe behavior in mind (`data-export-hidden`, canvas data attributes).
- Prefer Remixicon (`@remixicon/react`) with `className="size-4"`.
- Do not edit shadcn base components directly in `components/ui`; wrap them.

## Security

Do not include secrets in code, issues, PR descriptions, screenshots, or logs.

If you discover a security issue, contact maintainers privately instead of opening a public issue.

## License

This repository is licensed under AGPL-3.0. See [LICENSE](./LICENSE).
By submitting a pull request, you agree your contribution is licensed under AGPL-3.0.
