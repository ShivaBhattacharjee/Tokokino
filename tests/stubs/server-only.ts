// `server-only` throws when bundled outside a React Server Component. In the
// Vitest node/jsdom environment there is no such guard to enforce, so we alias
// the package to this empty module and let server modules import cleanly.
export {}
