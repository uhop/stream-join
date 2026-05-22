# AGENTS.md — stream-join

> `stream-join` is a toolkit of N→1 stream combinators: combine values from multiple streams into one, with proper backpressure handling. The package ships four primitives — `zip` (synchronous N-round combine), `select` (asymmetric advance with buffered pick), `race` (emit-as-ready), `concat` (sequential drain) — plus a small set of helpers under `src/utils/` for common merge patterns (k-way merge of sorted streams, priority-queue merge, drift-tolerant merge). Available in two flavors: Node Streams (default entry, `stream-join`) and Web Streams (`stream-join/web`).

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
- **Test (single file):** `node tests/test-<name>.js`
- **TypeScript check:** `npm run ts-check`
- **JavaScript check (tsc --checkJs):** `npm run js-check`
- **TypeScript tests:** `npm run ts-test`
- **Lint:** `npm run lint` (Prettier check)
- **Lint fix:** `npm run lint:fix` (Prettier write)

## Project structure

```
stream-join/
├── package.json              # Package config; "tape6" section configures test discovery
├── src/                      # Source code (ESM, "type": "module")
│   ├── index.js              # Node entry; default = zip, named = zip/select/race/concat
│   ├── index.d.ts
│   ├── zip.js                # Node wrapper: synchronous N-round combine
│   ├── zip.d.ts
│   ├── select.js             # Node wrapper: asymmetric advance + buffered pick
│   ├── select.d.ts
│   ├── race.js               # Node wrapper: emit-as-ready
│   ├── race.d.ts
│   ├── concat.js             # Node wrapper: sequential drain
│   ├── concat.d.ts
│   ├── generators/           # Shared runtime-neutral generator factories
│   │   ├── zip.js, zip.d.ts
│   │   ├── select.js, select.d.ts
│   │   ├── race.js, race.d.ts
│   │   └── concat.js, concat.d.ts
│   ├── utils/                # Helpers users compose into the main components
│   │   ├── pick-first.js     # Always returns 0; pair with sortedInsert
│   │   ├── pick-min.js       # Linear-scan min picker
│   │   ├── sorted-insert.js  # Maintains sorted order via nano-binary-search
│   │   ├── merge-sorted.js   # Umbrella: select + pickFirst + sortedInsert
│   │   └── *.d.ts
│   └── web/                  # Web Streams variant (mirrors src/ root)
│       ├── index.js, index.d.ts
│       ├── zip.js, zip.d.ts
│       ├── select.js, select.d.ts
│       ├── race.js, race.d.ts
│       ├── concat.js, concat.d.ts
│       ├── from-async-iterable.js, from-async-iterable.d.ts  # Internal: portable ReadableStream.from
│       └── utils/
│           └── merge-sorted.js, merge-sorted.d.ts            # Web mirror of utils/merge-sorted
├── tests/                    # Test files (test-*.js, test-*.ts, using tape-six)
├── dev-docs/                 # Internal design notes (not in the published tarball)
├── wiki/                     # GitHub wiki documentation (git submodule)
└── .github/                  # CI workflows, Dependabot config
```

The Node wrappers at `src/<comp>.js` and the Web wrappers at `src/web/<comp>.js` both import a pure, runtime-neutral generator factory from `src/generators/<comp>.js`. Helpers under `src/utils/` are pure functions, shared across both trees; `src/web/utils/merge-sorted.js` mirrors `src/utils/merge-sorted.js` against the Web `select`.

## Code style

- **ESM** throughout (`"type": "module"` in package.json). Both source and tests use `import` / `export`.
- **No transpilation** — code runs directly.
- **Lambda-style functions** for stand-alone definitions that don't use `this` (`const fn = (...) => …`); `function` declarations only for generators (`function*`) and the rare `this`-dependent case.
- **Prettier** for formatting (see `.prettierrc`): 100 char width, single quotes, no bracket spacing, no trailing commas, arrow parens "avoid".
- 2-space indentation.
- Semicolons are enforced by Prettier (default `semi: true`).

## Critical rules

- **Two runtime dependencies only: `stream-chain` and `nano-binary-search`.** Never add other packages to `dependencies`. `stream-chain` v4+ provides `readableFrom` (Node-side iterable → Readable), `streamPuller` (Node Readable → async iterator), and `webStreamPuller` (Web ReadableStream → async iterator). `nano-binary-search` is used by `sortedInsert`. Only `devDependencies` are otherwise allowed.
- **Generators are shared, wrappers are thin.** Every main component splits into a runtime-neutral generator factory at `src/generators/<comp>.js` plus two thin runtime wrappers (`src/<comp>.js` for Node, `src/web/<comp>.js` for Web). The wrapper validates inputs, builds pullers via stream-chain, calls the generator, and wraps the output. The generator does the actual work.
- **No Node-specific stream APIs in `src/generators/` or `src/web/`.** Generators trust their puller inputs; the Web tree must stay bundleable into a browser without dragging `node:stream` in.
- **Backpressure must be handled correctly.** The pullers manage per-stream backpressure; the components yield through `readableFrom` (Node) or `fromAsyncIterable` (Web) which both respect downstream demand. Do not add buffering on top.
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
- **Pullers (from stream-chain):** Node `streamPuller(stream)` wraps a `Readable` as an async iterator via `stream.iterator({destroyOnReturn: false})`; Web `webStreamPuller(stream)` wraps a `ReadableStream` via `stream[Symbol.asyncIterator]({preventCancel: true})`. Both preserve original error values and survive consumer-side early exit.

## Verification commands

- `npm test` — run the full test suite (parallel workers)
- `node tests/test-<name>.js` — run a single test file directly
- `npm run test:bun` — run with Bun
- `npm run test:deno` — run with Deno
- `npm run ts-check` — TypeScript type checking
- `npm run js-check` — `tsc --allowJs --checkJs` over the JS sources
- `npm run ts-test` — typing tests
- `npm run lint` — Prettier check
- `npm run lint:fix` — Prettier write

## File layout

- Node entry: `src/index.js` + `src/index.d.ts` (default export = `zip`; preserves the 1.x → 2.x bridge).
- Web entry: `src/web/index.js` + `src/web/index.d.ts` (default export = `zip` for Web Streams).
- Node wrappers: `src/zip.js`, `src/select.js`, `src/race.js`, `src/concat.js` (each with `.d.ts`).
- Web wrappers: `src/web/zip.js`, `src/web/select.js`, `src/web/race.js`, `src/web/concat.js` (each with `.d.ts`).
- Shared generators: `src/generators/{zip,select,race,concat}.{js,d.ts}` — pure factories, no runtime imports.
- Helpers: `src/utils/*.{js,d.ts}` (pure; shared between trees). Web mirror at `src/web/utils/merge-sorted.{js,d.ts}`.
- Tests: `tests/test-*.js` (functional), `tests/test-web.js` (Web Streams variant), `tests/test-typings-join.ts` (typing), `tests/helpers.js`.
- Design notes: `dev-docs/*.md` (internal; not in the published tarball).
- Wiki docs: `wiki/` (git submodule).

## When reading the codebase

- Start with `ARCHITECTURE.md` for the module map and dependency graph.
- Each main component's `.d.ts` is the canonical API reference for that component.
- `dev-docs/select-design.md` captures the design intent behind `select` and the helper layer.
- The `tests/` files demonstrate every supported usage pattern; `test-select.js`, `test-race.js`, and `test-concat.js` are good starting points. `test-web.js` exercises the Web Streams variant end-to-end.
- Wiki markdown files in `wiki/` contain detailed usage docs.
