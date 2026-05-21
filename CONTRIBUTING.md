# Contributing to Tokokino

Thanks for contributing to Tokokino.

## Project Overview

Tokokino is a client-heavy Next.js app for creating polished screenshot compositions. Most logic runs in-browser via Zustand. Backend/API routes are mainly for auth, sharing, and image proxying.

## Tech Stack

- Framework: Next.js 16 + React 19 + TypeScript
- Styling/UI: Tailwind CSS v4, shadcn/ui, Radix UI, motion
- State: Zustand
- Validation: Zod v4 (`zod/v4`)
- Auth: better-auth
- Data: MongoDB
- Object Storage: Cloudflare R2 (AWS S3 SDK)
- Tooling: ESLint, Prettier, Husky, lint-staged, pnpm

## License

This repository is licensed under Apache License 2.0. See [LICENSE](./LICENSE).

By submitting a pull request, you agree your contribution is licensed under Apache-2.0.

## Local Setup

1. Fork the repo and clone your fork.
2. Install dependencies:

```bash
pnpm install
```

3. Create your environment file (for features that require backend integrations):

```bash
cp .env.example .env.local
```

4. Start development:

```bash
pnpm dev
```

## Environment Variables (Important)

Configured and validated in `lib/env.ts`.

Required for sharing (R2 + DB):

- `CLOUDFLARE_R2_ENDPOINT`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`
- `NEXT_PUBLIC_R2_PUBLIC_BASE`

Required for auth:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID` (optional)
- `GOOGLE_CLIENT_SECRET` (optional)

## Contribution Workflow

1. Create a branch from `main`:

```bash
git checkout -b fix/short-description
```

2. Make focused changes.
3. Run checks before opening PR:

```bash
pnpm lint
pnpm typecheck
```

4. Commit using this repository style:

- `fix: <short message>`
- `refactor: <short message>`
- `delete: <short message>`
- `optimised: <short message>`

5. Push branch and open a Pull Request.

## Pull Request Guidelines

- Keep PRs small and focused.
- Explain what changed and why.
- Link related issues.
- Add screenshots/GIFs for UI changes.
- Mention breaking changes clearly.
- Confirm lint/typecheck pass locally.

Use the PR template at `.github/pull_request_template.md`.

## Filing Issues

Use the templates in `.github/ISSUE_TEMPLATE/`:

- Bug report
- Feature request
- General issue/task

Good issues include:

- Clear reproduction steps
- Expected vs actual behavior
- Environment details (browser/OS/version)
- Screenshots or recordings if relevant

## Implementation Notes for Contributors

- Use selectors with Zustand; avoid subscribing to the whole store in components.
- For numeric editor inputs, use existing helpers in `lib/editor/value-schemas.ts`.
- Keep export-safe behavior in mind (`data-export-hidden`, canvas data attributes).
- Prefer Remixicon (`@remixicon/react`) with `className="size-4"`.
- Do not edit shadcn base components directly in `components/ui`; wrap them.

## Security

Do not include secrets in code, issues, PR descriptions, screenshots, or logs.

If you discover a security issue, contact maintainers privately instead of opening a public issue.
