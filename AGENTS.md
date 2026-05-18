# AGENTS.md — stream-join

> `stream-join` joins values from multiple object-mode Readable streams into a single object-mode Readable, while properly handling backpressure. The result is a Readable that emits one combined value per round; per round, one item is pulled from each non-ended input stream (ended streams contribute `null`). An optional `joinItems` callback combines per-round items into zero or more output values.

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
- **Lint:** `npm run lint` (Prettier check)
- **Lint fix:** `npm run lint:fix` (Prettier write)

## Project structure

```
stream-join/
├── package.json          # Package config; "tape6" section configures test discovery
├── src/                  # Source code
│   ├── index.js          # join() factory built on stream-chain's readableFrom
│   └── index.d.ts        # TypeScript definitions for the public API
├── tests/                # Test files (test-*.mjs, test-*.cjs, using tape-six)
├── wiki/                 # GitHub wiki documentation (git submodule)
└── .github/              # CI workflows, Dependabot config
```

## Code style

- **CommonJS** throughout (`"type": "commonjs"` in package.json).
- **No transpilation** — code runs directly.
- **Prettier** for formatting (see `.prettierrc`): 100 char width, single quotes, no bracket spacing, no trailing commas, arrow parens "avoid".
- 2-space indentation.
- Semicolons are enforced by Prettier (default `semi: true`).
- Imports use `require()` syntax in source, `import` in tests (`.mjs`).

## Critical rules

- **One runtime dependency only: `stream-chain`.** Never add other packages to `dependencies`. Only `devDependencies` are otherwise allowed.
- **Built on `stream-chain`.** `join()` is implemented on top of `stream-chain/utils/readableFrom`. Do not reintroduce hand-rolled `Readable` + `pause/resume` mechanics; the modernized version uses async iteration.
- **Object mode is always on.** The output Readable is forced to `objectMode: true` regardless of caller options.
- **Backpressure must be handled correctly.** This is the whole point of the library — `readableFrom` provides pull-based async iteration; do not add buffering on top of it.
- **Do not modify or delete test expectations** without understanding why they changed.
- **Do not add comments or remove comments** unless explicitly asked.
- **Keep `src/index.js` and `src/index.d.ts` in sync.** All public API is exported from `index.js` and typed in `index.d.ts`.

## Architecture quick reference

- `join(streams, options)` is the only public export.
- Input streams must be object-mode `Readable` streams; they're consumed via `[Symbol.asyncIterator]()`.
- Each round: `Promise.all(iters.map(it => it.next()))` pulls one value per non-ended stream concurrently.
- A side-listener captures each stream's original `'error'` before the iterator's destroy wraps it in `AbortError`; the catch on `Promise.all` re-throws the captured original.
- `joinItems(sink, items)` combines per-round values. Default: `(sink, items) => sink.push(items)`.
- The output is produced via `readableFrom({iterable: zip, objectMode: true, ...})` from `stream-chain`.

## Verification commands

- `npm test` — run the full test suite (parallel workers)
- `node tests/test-<name>.mjs` — run a single test file directly
- `npm run test:bun` — run with Bun
- `npm run test:deno` — run with Deno
- `npm run ts-check` — TypeScript type checking
- `npm run js-check` — `tsc --allowJs --checkJs` over the JS sources
- `npm run lint` — Prettier check
- `npm run lint:fix` — Prettier write

## File layout

- Entry point: `src/index.js` + `src/index.d.ts`
- Tests: `tests/test-*.mjs`, `tests/test-*.cjs`, `tests/helpers.mjs`
- Wiki docs: `wiki/` (git submodule)

## When reading the codebase

- Start with `ARCHITECTURE.md` for the module map and dependency notes.
- `src/index.d.ts` is the canonical API reference.
- The `tests/` files demonstrate every supported usage pattern; `test-simple.mjs` and `test-join-items.mjs` are the best starting points.
- Wiki markdown files in `wiki/` contain detailed usage docs.
