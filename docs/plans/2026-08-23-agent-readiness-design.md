# Tokokino Agent Readiness Design

## Goal

Raise Tokokino's agent-readiness by making missing routes recoverable, publishing machine-readable identity and usage guidance, ensuring the homepage remains meaningful without JavaScript, and adding complete public trust pages without changing the editor or the established visual design.

## Constraints

- Tokokino deploys to Cloudflare Workers through OpenNext Cloudflare.
- The repository already uses the latest `@opennextjs/cloudflare` release, 1.20.2, with Next.js 16.2.12.
- OpenNext supports classic middleware but does not support Node Middleware. Next.js 16's newer proxy path uses the Node middleware model, so this implementation will not add `middleware.ts` or `proxy.ts`.
- The project is a personal open-source project, not a registered company. Public schema must not invent a phone number, street address, postal code, legal company name, or other credentials.
- Existing editor behavior, homepage visuals, and the homepage Contact anchor remain unchanged.

## Architecture

### Agent-friendly 404 responses

Keep the root `app/not-found.tsx` page so ordinary browser requests continue to receive the existing branded HTML page with a real 404 status. Expand its actions with recovery links to the homepage, editor, sitemap, and agent instructions.

For agents that request `Accept: text/markdown`, add a small static Route Handler that returns a concise Markdown recovery document with status 404, `Content-Type: text/markdown; charset=utf-8`, and `Vary: Accept`. Change `next.config.mjs` rewrites from the current array form to the object form: preserve all PostHog routes in `afterFiles`, then add a `fallback` rewrite for unmatched requests whose Accept header includes `text/markdown`. Because fallback rewrites run after filesystem and dynamic route matching, valid routes remain untouched and the handler is reached only for missing paths.

### Homepage without JavaScript

The homepage is already pre-rendered into raw HTML and contains well over 500 characters. Keep that architecture. Add a homepage-scoped `noscript` style that removes Motion's initial opacity, transform, and filter states when JavaScript is unavailable, making the pre-rendered content visible without affecting the JavaScript experience.

Correct the invalid heading nested inside the How It Works button by styling a non-heading element instead. The surrounding section heading and other content headings retain a logical H1/H2/H3 structure.

### Structured data

Render one escaped `application/ld+json` script on the homepage using an `@graph` with:

- `SoftwareApplication` for Tokokino, including its URL, editor URL, description, application category, browser operating-system support, free offer, feature list, and publisher reference.
- `Organization` for the open-source Tokokino project, including its URL, logo, email contact point, founder, social/source links, and a deliberately coarse `PostalAddress` containing only Guwahati, Assam, and India.

The data will live in a typed SEO module so the page rendering and tests consume the same public contract. JSON serialization will escape `<` as `\u003c` before insertion.

### Agent instructions

Rewrite `/llms.txt` to follow the llms.txt v2 document order: one H1, a blockquote summary, detailed guidance before any H2, then H2 sections made only of Markdown link lists. Add explicit `When to use Tokokino` and `How agents should use Tokokino` guidance covering screenshot polishing, multi-screenshot layouts, mockups, annotation, social graphics, local editing/export, and authenticated sharing.

Serve the file as Markdown text with UTF-8 encoding and link to the editor, product pages, trust pages, sitemap, and machine-readable endpoints.

### Trust pages and discovery

Add `/about` and `/contact` with the existing `DocPage`, Nav, and Footer design. Each page will contain at least 500 characters of substantive copy. About will explain the project, stewardship, local-first model, capabilities, and open-source status. Contact will route product questions to email, bugs and contributions to GitHub, and updates to X without adding a form or fabricated business details.

Add the routes to the sitemap, llms.txt, marketing footer, and editor footer. Keep the existing homepage Contact navigation anchored to `/#contact`.

## Testing and verification

Use focused Vitest tests to cover each changed contract before implementation:

- Markdown 404 response status, content type, vary header, and recovery links.
- HTML 404 recovery links.
- Homepage JSON-LD validity and required application/organization fields.
- No-JavaScript visibility fallback and valid How It Works heading structure.
- llms.txt format, when-to-use guidance, endpoint links, and response type.
- About and Contact route content length, headings, and real contact targets.
- Sitemap inclusion of both trust routes.

After focused tests pass, run the relevant test set, `pnpm typecheck`, and ESLint on changed source files. Do not run a production build. Start the local Next server only for command-line HTTP verification, then use curl—without opening a browser—to verify `/`, `/about`, `/contact`, `/privacy`, `/llms.txt`, `/sitemap.xml`, `/robots.txt`, an unknown HTML path, and an unknown Markdown path. Live tokokino.com can only be re-audited after deployment.
