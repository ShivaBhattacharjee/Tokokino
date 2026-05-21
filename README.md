<p align="center">
  <img src="https://github.com/user-attachments/assets/1103aebf-c59b-4ed6-b830-b82aa1b71f80" alt="Tokokino Logo" width="184" height="184" />
</p>

<h1 align="center">Tokokino</h1>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="Zustand" src="https://img.shields.io/badge/Zustand-State%20Management-7A3E2B" />
  <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white" />
</p>

Tokokino is a client-heavy Next.js app for creating polished screenshot visuals with backgrounds, overlays, and device mockups.

## Index

- [Installation](#installation)
- [Cloudflare D1](#cloudflare-d1)
- [Scripts](#scripts)
- [Install assets locally (curl/bash)](#install-assets-locally-curlbash)
- [Device frames](#device-frames)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

## Installation

### Prerequisites

- Node.js 20+
- pnpm 9+

### Setup

```bash
git clone https://github.com/shivabhattacharjee/tokokino.git
cd tokokino
pnpm install
```

### Environment

Create `.env.local` and configure required variables used by `lib/env.ts`.


### Run locally

```bash
pnpm dev
```

## Cloudflare D1

Auth and app metadata use the `TOKOKINO_DB` D1 binding configured in
`wrangler.jsonc`.

Apply migrations to the remote D1 database:

```bash
pnpm exec wrangler d1 migrations apply tokokino-db --remote
```

Apply migrations to a local D1 database:

```bash
pnpm exec wrangler d1 migrations apply tokokino-db --local
```

## Scripts

- `pnpm dev`: start Next.js dev server with Turbopack
- `pnpm build`: production build
- `pnpm start`: run production server
- `pnpm lint`: run ESLint
- `pnpm lint:fix`: fix ESLint issues
- `pnpm lint:strict`: ESLint with zero warnings
- `pnpm lint:fix:strict`: fix + zero warnings
- `pnpm typecheck`: run TypeScript type checks
- `pnpm format`: format TS/TSX files with Prettier
- `pnpm build:thumbs`: build/upload overlay thumbs to R2
- `pnpm build:backgrounds`: build/upload backgrounds + thumbs to R2 and update manifest

## Install assets locally (curl/bash)

To download overlays and device mockup assets locally from R2:

```bash
bash scripts/install-assets-local.sh
```

This saves files in:

- `public/assets/overlays/thumbs`
- `public/assets/device-mockups`
- `public/assets/device-mockups/thumbnails`

Override source base URL:

```bash
NEXT_PUBLIC_R2_PUBLIC_BASE="https://your-r2-public-base.example.com" bash scripts/install-assets-local.sh
```

Direct one-liner alternative:

```bash
curl -fsSL https://raw.githubusercontent.com/shivabhattacharjee/tokokino/main/scripts/install-assets-local.sh | bash
```

## Device frames

Device frame definitions and file names are in:

- `lib/mockups/index.ts`

The app resolves frame assets from:

- `${NEXT_PUBLIC_R2_PUBLIC_BASE}/Device-Mockups/device-mockups`
- `${NEXT_PUBLIC_R2_PUBLIC_BASE}/Device-Mockups/device-mockups/thumbnails`

## Tech Stack

- Next.js 16, React 19, TypeScript
- Zustand for client state
- Tailwind CSS v4 + shadcn/ui + Radix UI
- motion for animations
- Zod v4 validation
- better-auth for auth
- Cloudflare D1 for metadata
- Cloudflare R2 for draft state and assets

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md).

- Open bugs/features/tasks with GitHub issue templates
- Use PR template for pull requests

## License

Apache-2.0. See [LICENSE](./LICENSE).
