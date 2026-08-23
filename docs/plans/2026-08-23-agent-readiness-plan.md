# Tokokino Agent Readiness Implementation Plan

> Execute every behavior through a red-green-refactor cycle. Do not alter the existing dirty top-bar files while completing this plan.

**Goal:** Publish adapter-safe, machine-readable recovery, identity, instructions, and trust content while preserving Tokokino's current UI and editor behavior.

**Architecture:** Use standard App Router pages and Route Handlers. Negotiate Markdown only for unmatched paths through a Next.js fallback rewrite, avoiding unsupported Node middleware/proxy behavior in OpenNext Cloudflare.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript, OpenNext Cloudflare 1.20.2, Vitest, Testing Library.

---

## Task 1: Agent-friendly 404s

**Files:**

- Create: `tests/app/agent-not-found.test.tsx`
- Create: `app/agent-not-found/route.ts`
- Modify: `app/not-found.tsx`
- Modify: `next.config.mjs`

1. Add tests asserting the Markdown handler returns status 404, Markdown UTF-8 content, `Vary: Accept`, and links to `/`, `/app`, `/sitemap.xml`, and `/llms.txt`; assert the HTML page exposes equivalent recovery links.
2. Run the focused test and confirm it fails because the handler and links do not exist.
3. Add the Route Handler and recovery actions.
4. Preserve PostHog rewrites in `afterFiles`; add the Accept-aware rule under `fallback`.
5. Re-run the focused test and confirm it passes.

## Task 2: Homepage semantics and structured data

**Files:**

- Create: `tests/app/homepage-agent-readiness.test.tsx`
- Create: `lib/seo/tokokino-structured-data.ts`
- Modify: `app/page.tsx`
- Modify: `components/landing/landing-page-client.tsx`
- Modify: `components/landing/how-it-works.tsx`

1. Add tests asserting valid SoftwareApplication and Organization graph nodes, required public identity fields, no fabricated detailed address, escaped JSON serialization, a scoped no-JavaScript visibility rule, and no heading nested inside the How It Works button.
2. Run the focused test and confirm the missing contracts fail.
3. Add the typed structured-data graph and render it from the homepage with safe serialization.
4. Add the scoped `noscript` fallback and landing-page data attribute.
5. Replace the button-nested heading with a styled span.
6. Re-run the focused test and confirm it passes.

## Task 3: llms.txt instructions

**Files:**

- Create: `tests/app/llms-route.test.ts`
- Modify: `app/llms.txt/route.ts`

1. Add tests that execute the Route Handler and validate the document order, concrete when-to-use/how-to-use guidance, H2 link-list sections, trust links, and Markdown response type.
2. Run the test and confirm it fails on the current prose-under-H2 format and missing explicit guidance.
3. Rewrite the document in llms.txt v2 order and update the response headers.
4. Re-run the test and confirm it passes.

## Task 4: About and Contact trust pages

**Files:**

- Create: `tests/app/trust-pages.test.tsx`
- Create: `app/about/page.tsx`
- Create: `app/contact/page.tsx`
- Modify: `components/landing/footer.tsx`
- Modify: `components/editor/editor-footer.tsx`

1. Add tests asserting each page has its route-specific H1, at least 500 characters of meaningful content, correct email/GitHub/X targets, and discoverable footer links.
2. Run the test and confirm the routes are absent.
3. Add both pages using `DocPage`, with metadata and factual personal-project copy.
4. Add their discovery links while preserving the homepage contact anchor.
5. Re-run the test and confirm it passes.

## Task 5: Sitemap and endpoint verification

**Files:**

- Create: `tests/app/sitemap.test.ts`
- Modify: `app/sitemap.ts`

1. Add a test asserting `/about` and `/contact` appear as public sitemap URLs.
2. Run it and confirm it fails.
3. Add both routes with appropriate metadata.
4. Re-run the test and confirm it passes.
5. Run all new agent-readiness tests together.
6. Run `pnpm typecheck` and ESLint on changed source files.
7. Start `pnpm dev` and verify every required public and machine-readable endpoint with curl, including HTML and Markdown variants of an unknown path. Stop the server after verification.
8. Review `git diff` to ensure the unrelated top-bar changes remain untouched.
