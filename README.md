<p align="center">
  <img src="https://github.com/user-attachments/assets/1103aebf-c59b-4ed6-b830-b82aa1b71f80" alt="Tokokino Logo" width="184" height="184" />
</p>

<h1 align="center">Tokokino</h1>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15.5.18-black?logo=next.js" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="Zustand" src="https://img.shields.io/badge/Zustand-State%20Management-7A3E2B" />
  <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white" />
</p>

Tokokino is a client-heavy screenshot composer built with Next.js. It focuses on fast, in-browser editing with backgrounds, overlays, frames, and export/share flows backed by Cloudflare services.

## Stack

- Next.js `15.5.18`, React `19.2.x`, TypeScript `5.9.x`
- Zustand for editor state
- Tailwind CSS v4 + shadcn/ui
- OpenNext Cloudflare for build/deploy runtime
- Cloudflare D1 (`TOKOKINO_DB`) for app/auth metadata
- Cloudflare R2 for share/draft/media storage

## Local setup

### Requirements

- Node.js 20+
- pnpm 9+

### Install

```bash
git clone https://github.com/shivabhattacharjee/tokokino.git
cd tokokino
pnpm install
```

### Environment

Copy the example env file and fill in the values you need:

```bash
cp .env.example .env.local
```

### Run

```bash
pnpm dev
```

## Docker

Build and run the production image:

```bash
docker build -t tokokino .
docker run --env-file .env.local -p 3000:3000 tokokino
```

Run the dev target:

```bash
docker build --target dev -t tokokino-dev .
docker run --env-file .env.local -p 3000:3000 -v "$PWD:/app" tokokino-dev
```

The production image runs `pnpm build:next` during build and starts with `pnpm start`.

## Database (D1)

`wrangler.jsonc` configures the D1 binding as `TOKOKINO_DB`.

Apply migrations:

```bash
pnpm exec wrangler d1 migrations apply tokokino-db --local
pnpm exec wrangler d1 migrations apply tokokino-db --remote
```

## Scripts

- `pnpm dev` - Next.js dev with Turbopack
- `pnpm typecheck` - TypeScript check (`tsc --noEmit`)
- `pnpm lint` - ESLint
- `pnpm lint:fix` - ESLint autofix
- `pnpm build` - OpenNext Cloudflare build
- `pnpm build:next` - Next.js production build
- `pnpm format:check` - Prettier check for TypeScript files
- `pnpm preview` - OpenNext Cloudflare preview
- `pnpm deploy` - OpenNext Cloudflare deploy
- `pnpm cf-typegen` - regenerate `cloudflare-env.d.ts` from Wrangler bindings
- `pnpm build:thumbs` - build overlay thumbs
- `pnpm build:backgrounds` - build background thumbs/manifest

## Assets

Install local overlay/device assets:

```bash
bash scripts/install-assets-local.sh
```

Paths used:

- `public/assets/overlays/thumbs`
- `public/assets/device-mockups`
- `public/assets/device-mockups/thumbnails`

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

AGPL-3.0. See [LICENSE](./LICENSE).
