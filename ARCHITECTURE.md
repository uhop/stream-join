# Architecture

`stream-join` is a toolkit of N→1 stream combinators — functions that take an array of object-mode streams and return a single stream. Four primitives cover the four useful control-flow shapes: `zip` (all advance, combine), `select` (one advances, picked from a buffer), `race` (one advances, whichever resolves first), `concat` (sequential). Each lives in two flavors — Node Streams (`stream-join`) and Web Streams (`stream-join/web`) — that share a single runtime-neutral generator factory per component.

## Project layout

```
package.json                  # Package config; "tape6" section configures test discovery
src/                          # Source code (ESM, "type": "module")
├── index.js                  # Node entry; default = zip, named = zip/select/race/concat
├── index.d.ts
├── zip.js                    # Node wrapper: synchronous N-round combine
├── zip.d.ts
├── select.js                 # Node wrapper: asymmetric advance + buffered pick
├── select.d.ts
├── race.js                   # Node wrapper: emit-as-ready
├── race.d.ts
├── concat.js                 # Node wrapper: sequential drain
├── concat.d.ts
├── generators/               # Pure, runtime-neutral generator factories
│   ├── zip.js, zip.d.ts
│   ├── select.js, select.d.ts
│   ├── race.js, race.d.ts
│   └── concat.js, concat.d.ts
├── utils/                    # Helpers users compose into the main components
│   ├── pick-first.js, pick-first.d.ts
│   ├── pick-min.js, pick-min.d.ts
│   ├── sorted-insert.js, sorted-insert.d.ts
│   └── merge-sorted.js, merge-sorted.d.ts
└── web/                      # Web Streams variant
    ├── index.js, index.d.ts
    ├── zip.js, zip.d.ts
    ├── select.js, select.d.ts
    ├── race.js, race.d.ts
    ├── concat.js, concat.d.ts
    ├── from-async-iterable.js, from-async-iterable.d.ts  # Portable ReadableStream.from shim
    └── utils/
        └── merge-sorted.js, merge-sorted.d.ts            # Web mirror of utils/merge-sorted
tests/                        # Test files (test-*.js, test-*.ts using tape-six)
dev-docs/                     # Internal design notes (not in the published tarball)
wiki/                         # GitHub wiki documentation (git submodule)
.github/                      # CI workflows, Dependabot config
```

For each main component, the algorithm lives once at `src/generators/<comp>.js` as a pure async-generator factory operating on runtime-neutral async-iterator pullers. Two thin wrappers — `src/<comp>.js` (Node) and `src/web/<comp>.js` (Web) — adapt their runtime's stream type to a puller, run the generator, and adapt the output back to that runtime's stream type. Helpers under `src/utils/` are pure functions and are shared between both trees; `src/web/utils/merge-sorted.js` mirrors `src/utils/merge-sorted.js` against the Web `select`.

## Main components

### `zip(streams, options)`

**Control flow:** symmetric. Every round, one value is pulled from every non-ended input stream concurrently via `Promise.all`. Ended streams contribute `null` to the round's items array. The user's `joinItems(sink, items)` callback combines per-round values into 0 or more output values; each is yielded individually.

**Output cardinality:** the longest input stream's length (since the loop continues until every stream has ended).

**Default joinItems:** `(sink, items) => sink.push(items)` — emits the per-round items array as a single output value.

### `select(streams, options)`

**Control flow:** asymmetric. After a **parallel initial fill** of up to `windowSize` items per stream, the steady-state loop calls the user's `pick(items)` per round to choose ONE slot to emit; that slot's source stream is refilled via the user's `insert` (default: replace at `lastPos`) or removed via the user's `remove` if the stream has exhausted.

**Output cardinality:** total of all input streams' lengths (every value gets picked, eventually).

**Stop signals:** `pick` returning anything not in `[0, items.length)` — `undefined`, `null`, `NaN`, ±`Infinity`, negative, non-integer, ≥ length — ends the merge immediately.

### `race(streams, options)`

**Control flow:** opportunistic. All N streams have a pull in flight at any moment; `Promise.race` selects whichever resolves first. The resolved stream's value is emitted and its pull restarted. No buffering across rounds.

**Output cardinality:** total of all input streams' lengths. Order is non-deterministic — depends on how the input streams' data events interleave in the event loop.

### `concat(streams, options)`

**Control flow:** sequential. Stream 0 is fully drained, then stream 1, …, then stream N-1. Pullers are created lazily, one stream at a time, so future streams don't pre-buffer while earlier ones are still being consumed.

**Output cardinality:** total of all input streams' lengths, in stream-major order.

## Pullers and output adapters

Each main component reads its input streams through an async-iterator **puller** and writes its output through a runtime-specific iterable-to-stream **adapter**. Both come from `stream-chain` v4:

- **Node side.** `streamPuller(stream)` returns `Readable.iterator({destroyOnReturn: false})` — preserves the original `'error'` value, surfaces premature destroy as `Error('Premature close')`, and survives consumer-side early exit (`break` out of `for await`). `readableFrom({iterable, ...readableOpts})` wraps the generator's output as a Node `Readable`.
- **Web side.** `webStreamPuller(stream)` returns the stream's async iterator with `preventCancel: true` plus an explicit `cancel(reason)` method. `fromAsyncIterable(asyncIter)` (in `src/web/from-async-iterable.js`) wraps the generator's output as a Web `ReadableStream` via `new ReadableStream({pull, cancel})` — a portable equivalent to `ReadableStream.from` that also works on runtimes that don't yet ship the static method (Bun 1.3.14 is the current outlier).

The shared generator factories operate on the abstract `AsyncIterator<T>` shape — neither runtime's puller type leaks into the algorithm.

## Helpers (`src/utils/`)

All helpers compose with `select()` to express common merge patterns. They are pure functions over arrays and item values — no stream coupling — and are shared between the Node and Web trees.

- **`pickFirst`** — `() => 0`. Constant-time picker for sorted-buffer scenarios where the smallest slot is always at index 0.
- **`pickMin(lessFn)`** — linear scan returning the index of the smallest slot. `lessFn` operates on item values (the helper unwraps `slot.item` internally).
- **`sortedInsert(lessFn)`** — uses [`nano-binary-search`](https://www.npmjs.com/package/nano-binary-search) to find the insertion point. On post-pick refill: if the new slot belongs at the same logical position as the just-removed one, replaces in place (one assignment); otherwise, splices in an order that preserves the insertion index.
- **`mergeSorted(streams, lessFn, options?)`** — umbrella combining `select` + `pickFirst` + `sortedInsert(lessFn)`. The Node-side version (`src/utils/merge-sorted.js`) uses the Node `select`; the Web-side version (`src/web/utils/merge-sorted.js`) uses the Web `select`.

## Module dependency graph

```
src/index.js → src/zip.js → src/generators/zip.js
                          → stream-chain/utils/{readableFrom,streamPuller}.js (runtime dep)
src/{zip,select,race,concat}.js → src/generators/<same>.js
                                → stream-chain/utils/{readableFrom,streamPuller}.js

src/web/index.js → src/web/zip.js → src/generators/zip.js
                                 → stream-chain/utils/webStreamPuller.js (runtime dep)
                                 → src/web/from-async-iterable.js (internal)
src/web/{zip,select,race,concat}.js → src/generators/<same>.js
                                    → stream-chain/utils/webStreamPuller.js
                                    → src/web/from-async-iterable.js

src/utils/sorted-insert.js → nano-binary-search (runtime dep)
src/utils/merge-sorted.js → src/select.js + src/utils/{pick-first,sorted-insert}.js
src/web/utils/merge-sorted.js → src/web/select.js + src/utils/{pick-first,sorted-insert}.js
src/utils/{pick-first,pick-min}.js (no deps)
```

Two runtime dependencies total: `stream-chain` (^4.0.2 — for `readableFrom`, `streamPuller`, `webStreamPuller`) and `nano-binary-search` (for `sortedInsert`).

## Backpressure

Pull-based, end-to-end:

- The output stream advances only when its downstream consumer asks for data.
- The generator pulls from per-stream pullers as the output is drained.
- The Node `streamPuller` uses `Readable.iterator()` semantics (queue is paused while iterator is awaiting); the Web `webStreamPuller` uses the standard async-iterator on `ReadableStream` (the reader's `read()` returns only when a chunk is ready).
- No buffering is added between these layers.

## Error handling

Errors propagate end-to-end with the original value preserved:

1. An input stream errors.
2. The puller's `next()` rejects with the original error (no `AbortError` wrapping).
3. The generator's `await pullers[i].next()` throws.
4. The generator's `finally` block calls `pullers[i].return()` on each puller (releases the iterator without destroying the underlying stream).
5. The thrown error propagates to `readableFrom` (Node) or surfaces via `controller.error(e)` in `fromAsyncIterable` (Web), destroying the output stream with the original value.

## Testing

- **Framework:** `tape-six` (`tape6`).
- **Run all:** `npm test` (parallel workers via `tape6 --flags FO`).
- **Run single file:** `node tests/test-<name>.js`.
- **Run with Bun:** `npm run test:bun`.
- **Run with Deno:** `npm run test:deno`.
- **TypeScript check:** `npm run ts-check`.
- **`tsc --checkJs` against the JS sources:** `npm run js-check`.
- **Typing tests:** `npm run ts-test`.
- **Lint:** `npm run lint` (Prettier check).
- **Lint fix:** `npm run lint:fix` (Prettier write).

## Import paths

```js
// Node default (zip)
import zip from 'stream-join';
import {zip, select, race, concat} from 'stream-join';

// Node — per-component subpaths
import zip from 'stream-join/zip.js';
import select from 'stream-join/select.js';
import race from 'stream-join/race.js';
import concat from 'stream-join/concat.js';

// Web default (zip) and per-component
import zip from 'stream-join/web';
import {zip, select, race, concat} from 'stream-join/web';
import zip from 'stream-join/web/zip.js';

// Helpers (shared between trees)
import pickFirst from 'stream-join/utils/pick-first.js';
import pickMin from 'stream-join/utils/pick-min.js';
import sortedInsert from 'stream-join/utils/sorted-insert.js';
import mergeSorted from 'stream-join/utils/merge-sorted.js'; // Node merge
import mergeSorted from 'stream-join/web/utils/merge-sorted.js'; // Web merge
```

The Node entry's default export remains `zip` (also accessible as `import zip from 'stream-join'`) for back-compat with 1.x callers who imported the function under the name `join`. The Web entry's default export is also `zip`, for symmetry.

## What is NOT here

- **No sort.** Sorting streams is `stream-sorting`'s job; this package treats input order as given.
- **No SQL-style key-based join.** That's `stream-sorting`'s `mergeJoin` (forthcoming). This package's primitives know nothing about keys or sortedness.
- **No set operations.** Union, intersection, difference on sorted streams live in `stream-sorting`.
- **No 1→N operations.** That's `stream-fork`'s territory.
- **No async pick / insert / remove.** All component callbacks are synchronous.
- **No internal stream puller.** The puller substrate now lives in `stream-chain` v4 (`streamPuller` / `webStreamPuller`); the previous in-tree `src/stream-puller.js` was removed in 2.0.
