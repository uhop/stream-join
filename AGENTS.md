# AGENTS.md — stream-join

> `stream-join` is a toolkit of N→1 stream combinators: combine values from multiple object-mode Readable streams into a single Readable, with proper backpressure handling. The package ships four primitives — `zip` (synchronous N-round combine), `select` (asymmetric advance with buffered pick), `race` (emit-as-ready), `concat` (sequential drain) — plus a small set of helpers under `src/utils/` for building common patterns (k-way merge of sorted streams, priority-queue merge, drift-tolerant merge).

For project structure, module dependencies, and the architecture overview see [ARCHITECTURE.md](./ARCHITECTURE.md).
For detailed usage docs and API references see the [wiki](https://github.com/uhop/stream-join/wiki).

## Setup

This project uses a git submodule for the wiki:

```bash
git clone --recursive https://github.com/uhop/stream-join.git
cd stream-join
npm install
```

## Commands

- **Install:** `npm install`
- **Test:** `npm test` (runs `tape6 --flags FO`)
- **Test (Bun):** `npm run test:bun`
- **Test (Deno):** `npm run test:deno`
- **Test (single file):** `node tests/test-<name>.mjs`
- **TypeScript check:** `npm run ts-check`
- **JavaScript check (tsc --checkJs):** `npm run js-check`
- **TypeScript tests:** `npm run ts-test`
- **Lint:** `npm run lint` (Prettier check)
- **Lint fix:** `npm run lint:fix` (Prettier write)

## Project structure

```
stream-join/
├── package.json              # Package config; "tape6" section configures test discovery
├── src/                      # Source code
│   ├── index.js              # Entry point; re-exports zip as the default
│   ├── index.d.ts
│   ├── zip.js                # Main component: synchronous N-round combine
│   ├── zip.d.ts
│   ├── select.js             # Main component: asymmetric advance + buffered pick
│   ├── select.d.ts
│   ├── race.js               # Main component: emit-as-ready
│   ├── race.d.ts
│   ├── concat.js             # Main component: sequential drain
│   ├── concat.d.ts
│   ├── stream-puller.js      # Internal: event-based awaitable wrapper over Readable
│   ├── stream-puller.d.ts
│   └── utils/                # Helpers users compose into the main components
│       ├── pick-first.js     # Always returns 0; pair with sortedInsert
│       ├── pick-min.js       # Linear-scan min picker
│       ├── sorted-insert.js  # Maintains sorted order via nano-binary-search
│       ├── merge-sorted.js   # Umbrella: select + pickFirst + sortedInsert
│       └── *.d.ts
├── tests/                    # Test files (test-*.mjs, test-*.cjs, test-*.mts, using tape-six)
├── dev-docs/                 # Internal design notes (not in the published tarball)
├── wiki/                     # GitHub wiki documentation (git submodule)
└── .github/                  # CI workflows, Dependabot config
```

`src/utils/` follows the fleet convention of separating helpers from main components. Main components and shared internal infrastructure live at `src/` root; everything users compose **with** those main components lives under `src/utils/`.

## Code style

- **CommonJS** throughout (`"type": "commonjs"` in package.json).
- **No transpilation** — code runs directly.
- **Lambda-style functions** for stand-alone definitions that don't use `this` (`const fn = (...) => …`); `function` declarations only for generators (`function*`) and the rare `this`-dependent case.
- **Prettier** for formatting (see `.prettierrc`): 100 char width, single quotes, no bracket spacing, no trailing commas, arrow parens "avoid".
- 2-space indentation.
- Semicolons are enforced by Prettier (default `semi: true`).
- Imports use `require()` syntax in source, `import` in tests (`.mjs`).

## Critical rules

- **Two runtime dependencies only: `stream-chain` and `nano-binary-search`.** Never add other packages to `dependencies`. `stream-chain` provides `readableFrom` (async-iterable → Readable conversion); `nano-binary-search` is used by `sortedInsert`. Only `devDependencies` are otherwise allowed.
- **Built on a shared `makeStreamPuller`.** All main components read input streams via the internal `src/stream-puller.js`, which is an event-based wrapper (`stream.on('data'|'end'|'error'|'close')`) returning a Promise per `next()`. Do not use Node's `[Symbol.asyncIterator]()` on input streams — it wraps the original `'error'` value in `AbortError`, loses the cause, and behaves inconsistently across Node minor releases.
- **Object mode is always on.** Every main component forces `objectMode: true` on its output Readable regardless of caller options.
- **Backpressure must be handled correctly.** The puller manages per-stream pause/resume; the components yield through `readableFrom` which respects downstream demand. Do not add buffering on top.
- **Do not modify or delete test expectations** without understanding why they changed.
- **Do not add comments or remove comments** unless explicitly asked.
- **Keep `.js` and `.d.ts` files in sync** for every source file. All public API has a hand-written `.d.ts` sidecar with the `// @ts-self-types="./X.d.ts"` directive at the top of the `.js`.
- **Helpers live under `src/utils/`.** Main components and shared infrastructure stay at `src/` root.

## Architecture quick reference

- **`zip(streams, options)`** — pulls one value per non-ended stream every round via `Promise.all`, passes the per-round items (with `null` for ended streams) to `joinItems`, yields the collected outputs. Symmetric advance.
- **`select(streams, options)`** — initial parallel fill of up to `windowSize` items per stream; per round, the user's `pick(items)` selects one slot to emit; that slot's source is refilled via `insert` (default: replace at lastPos) or removed via `remove` if the stream exhausted. Asymmetric advance — one stream advances per emit.
- **`race(streams, options)`** — pulls one item from each stream in parallel; `Promise.race` selects whichever resolves first; emits that value and restarts the pull on its source. No buffering across rounds.
- **`concat(streams, options)`** — drains stream 0 fully, then stream 1, …, then stream N-1. Pullers are created lazily, one per stream, so future streams aren't pre-buffering.
- **Helpers under `src/utils/`:** `pickFirst` (always 0), `pickMin(lessFn)` (linear scan), `sortedInsert(lessFn)` (binary-search-based, with smart replace-or-splice when the new slot belongs at the same position as the removed one), `mergeSorted(streams, lessFn, opts?)` (umbrella combining `select` + `pickFirst` + `sortedInsert`).
- **`makeStreamPuller(stream)`** — internal. Returns `{next, close}` where `next()` resolves to `{value, done}` and propagates original error values. Used by all four main components.

## Verification commands

- `npm test` — run the full test suite (parallel workers)
- `node tests/test-<name>.mjs` — run a single test file directly
- `npm run test:bun` — run with Bun
- `npm run test:deno` — run with Deno
- `npm run ts-check` — TypeScript type checking
- `npm run js-check` — `tsc --allowJs --checkJs` over the JS sources
- `npm run ts-test` — typing tests
- `npm run lint` — Prettier check
- `npm run lint:fix` — Prettier write

## File layout

- Entry point: `src/index.js` + `src/index.d.ts` (re-exports `zip` as the default for back-compat with 1.x naming).
- Main components: `src/zip.js`, `src/select.js`, `src/race.js`, `src/concat.js` (each with its `.d.ts`).
- Internal infrastructure: `src/stream-puller.js`.
- Helpers: `src/utils/*.js` (each with its `.d.ts`).
- Tests: `tests/test-*.mjs`, `tests/test-*.cjs`, `tests/test-*.mts`, `tests/helpers.mjs`.
- Design notes: `dev-docs/*.md` (internal; not in the published tarball).
- Wiki docs: `wiki/` (git submodule).

## When reading the codebase

- Start with `ARCHITECTURE.md` for the module map and dependency graph.
- Each main component's `.d.ts` is the canonical API reference for that component.
- `dev-docs/select-design.md` captures the design intent behind `select` and the helper layer.
- The `tests/` files demonstrate every supported usage pattern; `test-select.mjs`, `test-race.mjs`, and `test-concat.mjs` are good starting points.
- Wiki markdown files in `wiki/` contain detailed usage docs.
