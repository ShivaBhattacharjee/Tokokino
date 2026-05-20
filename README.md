<p align="center">
  <img src="https://github.com/user-attachments/assets/b8d39faf-200e-468a-80b1-0bc0025e1867"alt="Noctivy Logo" width="84" height="84" />
</p>

<h1 align="center">Noctivy</h1>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" />
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="Zustand" src="https://img.shields.io/badge/Zustand-State%20Management-7A3E2B" />
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white" />
  <img alt="Cloudflare R2" src="https://img.shields.io/badge/Cloudflare-R2-F38020?logo=cloudflare&logoColor=white" />
</p>

Noctivy is a client-heavy Next.js app for creating polished screenshot visuals with backgrounds, overlays, and device mockups.

## Index

- [Installation](#installation)
- [Docker](#docker)
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
git clone https://github.com/shivabhattacharjee/noctivy.git
cd noctivy
pnpm install
```

### Environment

Create `.env.local` and configure required variables used by `lib/env.ts`.

Required for share storage:

- `CLOUDFLARE_R2_ENDPOINT`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`
- `NEXT_PUBLIC_R2_PUBLIC_BASE`
- `MONGODB_URI`

Required for auth:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID` (optional)
- `GOOGLE_CLIENT_SECRET` (optional)

### Run locally

```bash
pnpm dev
```

## Docker

This repo includes Docker setup for local MongoDB with replica set support (`docker-compose.yml` + `docker/mongo/Dockerfile`).

Start MongoDB:

```bash
docker compose up -d mongo
```

Stop MongoDB:

```bash
docker compose down
```

Use this local connection string in `.env.local`:

```bash
MONGODB_URI="mongodb://noctivy:noctivy@localhost:27017/noctivy?authSource=admin&replicaSet=rs0"
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
curl -fsSL https://raw.githubusercontent.com/shivabhattacharjee/noctivy/main/scripts/install-assets-local.sh | bash
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
- MongoDB for metadata
- Cloudflare R2 (S3 SDK) for share/assets storage

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md).

- Open bugs/features/tasks with GitHub issue templates
- Use PR template for pull requests

## License

Apache-2.0. See [LICENSE](./LICENSE).
