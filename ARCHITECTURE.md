# Architecture

`stream-join` is a tiny library that combines values from multiple object-mode Readable streams into a single Readable. The whole library is a single function in `src/index.js` built on top of `stream-chain`'s `readableFrom` utility.

## Project layout

```
package.json              # Package config; "tape6" section configures test discovery
src/                      # Source code
├── index.js              # The join() factory
└── index.d.ts            # TypeScript declarations for the public API
tests/                    # Test files (test-*.mjs, test-*.cjs, using tape-six)
├── helpers.mjs           # streamFromArray, streamToArray, PassThrough, streamToArrayOnce
├── test-simple.mjs       # Default joinItems, even/uneven streams, edge cases
├── test-join-items.mjs   # Custom joinItems patterns
├── test-errors.mjs       # Error propagation
├── test-chain.mjs        # Composition with stream-chain
└── test-cjs.cjs          # CommonJS require() smoke test
wiki/                     # GitHub wiki documentation (git submodule)
.github/                  # CI workflows, Dependabot config
```

## Core concepts

### How join() works

1. The caller passes an array of object-mode `Readable` streams (one or more).
2. `join()` immediately throws `TypeError` if the array is empty or missing.
3. An async generator `zip()` is set up to drive the iteration; it is handed to `stream-chain`'s `readableFrom` to produce the output `Readable`.
4. The generator attaches a side `'error'` listener on every input stream before creating iterators. This captures the original error value even after Node's async-iterator-on-Readable replaces it with an `AbortError` during destruction.
5. Iteration loop:
   - For each non-ended stream, `it.next()` is awaited via `Promise.all` (concurrent pull).
   - Results are inspected positionally: `{done: true}` marks the stream as ended; `{value}` populates `items[i]`.
   - When every stream is ended in a given round, the generator returns.
   - Otherwise, the round's `items` array is passed to `joinItems(sink, items)`, which can push 0 or more output values via `sink.push(value)`. Each pushed value is yielded one-by-one.
6. On error, the captured original error (if any) is thrown out of the generator; `readableFrom` catches it and destroys the output with the same error, surfacing it on the output's `'error'` event.

### Backpressure

`stream-chain`'s `readableFrom` drives the generator pull-by-pull: it advances the generator only when the output's downstream consumer asks for more data. The generator's `await Promise.all(iters.map(it => it.next()))` in turn drives each input stream's async iterator, which respects each stream's own backpressure semantics. No buffering is added on top.

### Default joinItems

```js
const defaultJoinItems = (sink, items) => sink.push(items);
```

So by default, each round's items array is emitted as a single output value (an array). Callers that want per-element output or filtering supply their own `joinItems`.

### Error preservation

Node's `Readable[Symbol.asyncIterator]()` rejects pending `.next()` promises with an `AbortError` ("The operation was aborted") after destroying the stream — the original error becomes invisible from the iterator side. To preserve it, `zip()` attaches its own `'error'` listener on each stream _before_ the iterators are created. When the catch on `Promise.all` runs, it prefers the captured original over whatever was thrown by `Promise.all`. The handlers are removed in a `finally` block so the generator does not leave stale listeners attached.

## Module dependency graph

```
src/index.js
    └── stream-chain/utils/readableFrom.js  (runtime dep)
            └── stream-chain/defs.js        (transitive)
```

That's it. The entire public surface is one factory function, one runtime dependency.

## Testing

- **Framework:** `tape-six` (`tape6`).
- **Run all:** `npm test` (parallel workers via `tape6 --flags FO`).
- **Run single file:** `node tests/test-<name>.mjs`.
- **Run with Bun:** `npm run test:bun`.
- **Run with Deno:** `npm run test:deno`.
- **TypeScript check:** `npm run ts-check`.
- **`tsc --checkJs` against the JS sources:** `npm run js-check`.
- **Lint:** `npm run lint` (Prettier check).
- **Lint fix:** `npm run lint:fix` (Prettier write).

## Import paths

```js
// Main API
import join from 'stream-join';
const join = require('stream-join');
```

There are no other entry points — `stream-join` is a single-function library. For composition, use `stream-chain` with `join()`'s Readable output as the first item in the chain.
