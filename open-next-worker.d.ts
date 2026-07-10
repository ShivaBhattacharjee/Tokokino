// The OpenNext Cloudflare build emits `.open-next/worker.js`, which `worker.ts`
// imports as its base handler. That file only exists after `pnpm build`, but the
// generated `worker-configuration.d.ts` references `./worker` (via `main` in
// wrangler.jsonc), so `worker.ts` is always pulled into the type program — even
// during a plain `tsc --noEmit` / pre-commit typecheck with no build present.
//
// Declaring the module's shape here lets typecheck resolve the import without the
// build artifact, so `pnpm typecheck` passes on a clean checkout.
declare module "*/.open-next/worker.js" {
  // The real OpenNext handler always provides `fetch`; mark it required so
  // `worker.ts` can delegate to `handler.fetch(...)` without a possibly-undefined
  // guard.
  const handler: ExportedHandler & Required<Pick<ExportedHandler, "fetch">>
  export default handler
}
