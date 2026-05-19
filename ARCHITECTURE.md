# Architecture

`stream-join` is a toolkit of N→1 stream combinators — functions that take an array of object-mode `Readable` streams and return a single object-mode `Readable`. Four primitives cover the four useful control-flow shapes: `zip` (all advance, combine), `select` (one advances, picked from a buffer), `race` (one advances, whichever resolves first), `concat` (sequential). All four share a single internal piece of infrastructure (the stream puller) and are produced through `stream-chain`'s `readableFrom`.

## Project layout

```
package.json                  # Package config; "tape6" section configures test discovery
src/                          # Source code
├── index.js                  # Entry point; re-exports zip as the default
├── index.d.ts
├── zip.js                    # Main component: synchronous N-round combine
├── zip.d.ts
├── select.js                 # Main component: asymmetric advance + buffered pick
├── select.d.ts
├── race.js                   # Main component: emit-as-ready
├── race.d.ts
├── concat.js                 # Main component: sequential drain
├── concat.d.ts
├── stream-puller.js          # Internal: event-based awaitable wrapper over Readable
├── stream-puller.d.ts
└── utils/                    # Helpers users compose into the main components
    ├── pick-first.js         # Always returns 0
    ├── pick-first.d.ts
    ├── pick-min.js           # Linear-scan min picker
    ├── pick-min.d.ts
    ├── sorted-insert.js      # Sorted-order insert via nano-binary-search
    ├── sorted-insert.d.ts
    ├── merge-sorted.js       # Umbrella: select + pickFirst + sortedInsert
    └── merge-sorted.d.ts
tests/                        # Test files (test-*.mjs, test-*.cjs, test-*.mts using tape-six)
dev-docs/                     # Internal design notes (not in the published tarball)
wiki/                         # GitHub wiki documentation (git submodule)
.github/                      # CI workflows, Dependabot config
```

The split between `src/` root and `src/utils/` is structural: **main components and shared internal infrastructure** stay at root; **helpers users compose with main components** go under `utils/`. Per the [fleet convention](https://github.com/uhop/stream-chain) (see also `stream-chain`'s `src/` layout).

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

## The shared stream puller

`src/stream-puller.js` is the internal substrate every main component uses. Given a Readable, it returns `{next, close}`:

- `next()` returns `Promise<{value, done}>`, resolving with the next chunk (`done: false`) or signalling end (`done: true`). Rejects on `'error'` with the **original** error value (no `AbortError` wrapper) and on premature `'close'` with a synthetic error.
- `close()` removes the puller's listeners. Idempotent.

**Why it exists.** Node's `Readable[Symbol.asyncIterator]()` wraps the original `'error'` value in `AbortError` during teardown and has had subtle behavioural shifts across Node minor releases. The puller is a thin event-based equivalent — listens for `'data'`/`'end'`/`'error'`/`'close'`, manages pause/resume for backpressure, and exposes original errors directly. All four main components consume it.

**Not exported publicly.** The contract may change between minor releases; callers should use the main components.

## Helpers (`src/utils/`)

All helpers compose with `select()` to express common merge patterns.

- **`pickFirst`** — `() => 0`. Constant-time picker for sorted-buffer scenarios where the smallest slot is always at index 0.
- **`pickMin(lessFn)`** — linear scan returning the index of the smallest slot. `lessFn` operates on item values (the helper unwraps `slot.item` internally).
- **`sortedInsert(lessFn)`** — uses [`nano-binary-search`](https://www.npmjs.com/package/nano-binary-search) to find the insertion point. On post-pick refill: if the new slot belongs at the same logical position as the just-removed one, replaces in place (one assignment); otherwise, splices in an order that preserves the insertion index.
- **`mergeSorted(streams, lessFn, options?)`** — umbrella combining `select` + `pickFirst` + `sortedInsert(lessFn)`. The headline k-way-merge helper for sorted streams.

## Module dependency graph

```
src/index.js → src/zip.js
src/zip.js, src/select.js, src/race.js, src/concat.js
        ↓
   src/stream-puller.js (internal)
        ↓
   stream-chain/utils/readableFrom.js (runtime dep)

src/utils/sorted-insert.js → nano-binary-search (runtime dep)
src/utils/merge-sorted.js → src/select.js + src/utils/pick-first.js + src/utils/sorted-insert.js
src/utils/pick-first.js (no deps)
src/utils/pick-min.js (no deps)
```

Two runtime dependencies total: `stream-chain` (for `readableFrom`) and `nano-binary-search` (for `sortedInsert`).

## Backpressure

Pull-based, end-to-end:

- The output Readable (from `readableFrom`) advances only when its downstream consumer asks for data.
- The generator that drives each main component pulls from the per-stream pullers as the output is drained.
- The puller maps each `next()` call to a Promise resolved by the next `'data'` event from its stream; in the meantime the stream is paused. When the local buffer drains, the stream resumes.
- No buffering is added between these layers.

## Error handling

Errors propagate end-to-end with the original value preserved:

1. An input stream emits `'error'` with value `err`.
2. The puller's `onError` handler stores `err` and rejects any pending `next()` waiter with `err`.
3. The generator's `await pullers[i].next()` throws `err`.
4. The generator's `finally` block closes all pullers (drops listeners).
5. The thrown `err` propagates to `readableFrom`, which destroys the output stream with `err`.
6. The output emits `'error'` with `err` to its consumer.

No `AbortError` wrapping, no side-listener hacks — the puller exposes raw `'error'` values directly.

## Testing

- **Framework:** `tape-six` (`tape6`).
- **Run all:** `npm test` (parallel workers via `tape6 --flags FO`).
- **Run single file:** `node tests/test-<name>.mjs`.
- **Run with Bun:** `npm run test:bun`.
- **Run with Deno:** `npm run test:deno`.
- **TypeScript check:** `npm run ts-check`.
- **`tsc --checkJs` against the JS sources:** `npm run js-check`.
- **Typing tests:** `npm run ts-test`.
- **Lint:** `npm run lint` (Prettier check).
- **Lint fix:** `npm run lint:fix` (Prettier write).

## Import paths

```js
// Default (zip)
const zip = require('stream-join');
const zip = require('stream-join/zip');

// Other main components
const select = require('stream-join/select');
const race = require('stream-join/race');
const concat = require('stream-join/concat');

// Helpers
const pickFirst = require('stream-join/utils/pick-first');
const pickMin = require('stream-join/utils/pick-min');
const sortedInsert = require('stream-join/utils/sorted-insert');
const mergeSorted = require('stream-join/utils/merge-sorted');
```

The default export remains `zip` (also accessible as `require('stream-join')`) for back-compat with 1.x callers who imported the function under the name `join`.

## What is NOT here

- **No sort.** Sorting streams is `stream-sorting`'s job; this package treats input order as given.
- **No SQL-style key-based join.** That's `stream-sorting`'s `mergeJoin` (forthcoming). This package's primitives know nothing about keys or sortedness.
- **No set operations.** Union, intersection, difference on sorted streams live in `stream-sorting`.
- **No 1→N operations.** That's `stream-fork`'s territory.
- **No async pick / insert / remove.** All component callbacks are synchronous.
- **No `[Symbol.asyncIterator]()` on input streams.** Internal stream reads go exclusively through `makeStreamPuller`; the async-iterator interface is treated as experimental and avoided.
