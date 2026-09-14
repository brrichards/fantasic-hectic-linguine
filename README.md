# fantasic-hectic-linguine

Microsoft FHL 2026 Fall project focusing on consumer utilization of Shared Tree/Fluid Framework APIs

A React app built on a single [SharedTree](https://fluidframework.com/docs/data-structures/tree)
holding a counter; a **+1** button increments it and the value syncs live across
every client in the session.

## Stack

- React 19.2 + TypeScript 6 + [Vite](https://vite.dev)
- [`fluid-framework`](https://www.npmjs.com/package/fluid-framework) 3.x (ESM-only, requires TS 6+) with
  `@fluidframework/tinylicious-client` and [tinylicious](https://fluidframework.com/docs/testing/tinylicious)
  as the local Fluid service
- Vitest + React Testing Library for unit tests, Playwright for the live sync check

Version notes:

- Fluid 3.x requires TypeScript 6+, `moduleResolution: "bundler"`/Node16, and strict
  null checks (`strict` is enabled in `tsconfig.app.json`).
- React 19 matches Microsoft's current official SharedTree examples. Do not add the
  `@fluidframework/react` helper package — it is alpha and hard-depends on React 18.

## Getting started

```sh
npm install
npm run start:server   # tinylicious, the local Fluid service (port 7070)
npm run dev            # Vite dev server (port 5173), in a second terminal
```

Open http://localhost:5173 — the app creates a Fluid container and puts its id in
the URL hash. Open that full URL (hash included) in another tab or browser to join
the same session and watch the counter sync.

## Scripts

| Script                 | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                       |
| `npm run start:server` | Start tinylicious (local Fluid service)         |
| `npm test`             | Run unit tests (Vitest)                         |
| `npm run build`        | Typecheck and build for production              |
| `npm run lint`         | Lint with oxlint                                |

With both servers running, `node e2e/sync-check.mjs` drives two Playwright browser
clients through a full create/join/increment cycle and verifies they converge
(add `--headed` to watch it).

## Layout

- `src/fluid/schema.ts` — the SharedTree schema: a `Counter` object node with an
  `increment()` method
- `src/fluid/client.ts` — tinylicious container create/load and the tree view
- `src/App.tsx` — renders the count and subscribes to tree changes via
  `Tree.on(node, "nodeChanged", ...)`, so local clicks and remote edits render
  through the same path
