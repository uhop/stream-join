# stream-join [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/stream-join.svg
[npm-url]: https://npmjs.org/package/stream-join

`stream-join` is a toolkit of N→1 stream combinators — functions that take an array of streams and return a single stream, with proper backpressure handling. Two flavors share a single algorithm per component: Node Streams ([`Readable`](https://nodejs.org/api/stream.html#stream_readable_streams)) via the default entry, Web Streams ([`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)) via the `stream-join/web` subpath. Four primitives cover the useful control-flow shapes:

- **`zip`** — symmetric advance: one value per non-ended stream per round, combined via `joinItems`
- **`select`** — asymmetric advance: a user-defined `pick` chooses one slot per round from a buffer
- **`race`** — emit-as-ready: whichever stream's data resolves first wins
- **`concat`** — sequential drain: stream 0, then 1, …, then N-1

Plus a small set of helpers under [`stream-join/utils/`](#helpers) for composing common merge patterns (k-way merge of sorted streams, priority-queue merge, drift-tolerant merge).

`stream-join` is a lightweight micro-package (ESM, Node 22+) built on [`stream-chain`](https://www.npmjs.com/package/stream-chain) and [`nano-binary-search`](https://www.npmjs.com/package/nano-binary-search) — its only runtime dependencies. It is distributed under New BSD license.

## Installation

```bash
npm i stream-join
```

## Quick start

`zip` is the default export — taking values from each stream in lockstep:

```js
import zip from 'stream-join';
import {Readable} from 'node:stream';

const s1 = Readable.from([1, 2, 3]);
const s2 = Readable.from(['a', 'b', 'c']);

zip([s1, s2]).on('data', data => console.log(data));
// [1, 'a']
// [2, 'b']
// [3, 'c']
```

For other patterns, import the corresponding component:

```js
import select from 'stream-join/select.js';
import race from 'stream-join/race.js';
import concat from 'stream-join/concat.js';
import mergeSorted from 'stream-join/utils/merge-sorted.js';
```

For Web Streams, swap `'stream-join'` for `'stream-join/web'`:

```js
import zip from 'stream-join/web';
import {zip, select, race, concat} from 'stream-join/web';
import select from 'stream-join/web/select.js';
import mergeSorted from 'stream-join/web/utils/merge-sorted.js';
```

The Web entry expects `ReadableStream` inputs and returns a `ReadableStream` output. The algorithm, options surface, and helpers are identical to the Node side — only the I/O type changes. The Web tree pulls in no `node:stream` code, so it stays bundleable for browsers and edge runtimes.

## The four primitives

### `zip(streams, options?)` — symmetric N-round combine

```ts
zip<T = readonly (unknown | null)[]>(
  streams: Readable[],
  options?: {
    joinItems?: (sink: {push(v: T): void}, items: readonly (unknown | null)[]) => void | Promise<void>;
    skipEvents?: boolean; // legacy no-op
    // …plus any ReadableOptions
  }
): Readable;
```

**Parameters.**

- `streams` — non-empty array of object-mode `Readable` streams. Throws `TypeError` if missing or empty.
- `options.joinItems(sink, items)` — optional combine callback called once per round with the per-stream values (in positional order; `null` for ended streams). Call `sink.push(value)` 0 or more times to emit. May be `async`. Default: `(sink, items) => sink.push(items)`.
- `options.skipEvents` — legacy 1.x option, accepted as no-op in 2.x.

**Returns** an object-mode `Readable` that emits the combined values; ends when every input stream has ended; propagates input-stream `'error'` events with the original value preserved.

```js
import zip from 'stream-join';

const s1 = Readable.from([1, 2, 3, 4]);
const s2 = Readable.from(['a', 'b']);

zip([s1, s2]).on('data', data => console.log(data));
// [1, 'a']
// [2, 'b']
// [3, null]   // s2 has ended
// [4, null]
```

Custom output via `joinItems`:

```js
zip([s1, s2], {
  joinItems(sink, items) {
    items.forEach(item => {
      if (item !== null) sink.push(item);
    });
  }
}).on('data', data => console.log(data));
// 1, 'a', 2, 'b', 3
```

### `select(streams, options)` — buffered pick-one

```ts
select(
  streams: Readable[],
  options: {
    pick: (items: readonly Slot<T>[]) => number;          // required
    insert?: (items: Slot<T>[], newSlot: Slot<T>, lastPos?: number) => void;
    remove?: (items: Slot<T>[], lastPos: number) => void;
    windowSize?: number; // default 1
    // …plus any ReadableOptions
  }
): Readable;

interface Slot<T> { item: T; index: number; }
```

**Parameters.**

- `streams` — non-empty array of object-mode `Readable` streams. Throws `TypeError` if missing or empty.
- `options.pick(items)` — **required**. Returns the index in `items` of the slot to emit and refill. Stop signal: any return value outside `[0, items.length)` (negative, `NaN`, `undefined`, `null`, ±`Infinity`, non-integer, ≥ length) ends the merge.
- `options.insert(items, newSlot, lastPos?)` — optional. Mutates `items` in place. `lastPos === undefined` during initial fill (length MAY grow); `lastPos` defined during steady-state refill (length MUST stay unchanged). Default: replace at `lastPos` (or `push` when undefined).
- `options.remove(items, lastPos)` — optional. Called when the source stream of `items[lastPos]` has exhausted; must decrease `items.length` by 1. Default: `items.splice(lastPos, 1)`.
- `options.windowSize` — optional positive integer; per-stream buffer depth. Default `1`. Larger values tolerate local disorder in input streams.

**Returns** an object-mode `Readable` that emits one value per round; output element type is the union of the input streams' value types; ends when every stream has exhausted or `pick` returns a stop signal; propagates input-stream `'error'` events with the original value preserved.

```js
import select from 'stream-join/select.js';
import pickMin from 'stream-join/utils/pick-min.js';

// Priority-queue merge: emit the smallest available value each round
select([Readable.from([1, 4, 7]), Readable.from([2, 5, 8]), Readable.from([3, 6, 9])], {
  pick: pickMin((a, b) => a < b)
}).on('data', x => console.log(x));
// 1, 2, 3, 4, 5, 6, 7, 8, 9
```

### `race(streams, options?)` — emit-as-ready

```ts
race(streams: Readable[], options?: ReadableOptions): Readable;
```

**Parameters.**

- `streams` — non-empty array of object-mode `Readable` streams. Throws `TypeError` if missing or empty.
- `options` — optional. Standard `ReadableOptions` (the output is forced to `objectMode: true`).

**Returns** an object-mode `Readable` that emits values in event-loop-arrival order from across all input streams; output element type is the union of the input streams' value types; ends when every stream has ended; propagates input-stream `'error'` events with the original value preserved.

Output order is non-deterministic — it reflects how the input streams' data events interleave in the event loop.

```js
import race from 'stream-join/race.js';

race([logStreamA, logStreamB, logStreamC]).on('data', event => process(event));
```

### `concat(streams, options?)` — sequential drain

```ts
concat(streams: Readable[], options?: ReadableOptions): Readable;
```

**Parameters.**

- `streams` — non-empty array of object-mode `Readable` streams. Drained left-to-right. Throws `TypeError` if missing or empty.
- `options` — optional. Standard `ReadableOptions` (the output is forced to `objectMode: true`).

**Returns** an object-mode `Readable` that emits stream 0's values, then stream 1's, …, then stream N-1's; output element type is the union of the input streams' value types; ends when every stream has ended; propagates input-stream `'error'` events with the original value preserved. Pullers are created lazily, one stream at a time, so later streams don't pre-buffer.

```js
import concat from 'stream-join/concat.js';

concat([part1, part2, part3]).on('data', chunk => collect(chunk));
```

## Helpers

```js
import pickFirst from 'stream-join/utils/pick-first.js';
import pickMin from 'stream-join/utils/pick-min.js';
import sortedInsert from 'stream-join/utils/sorted-insert.js';
import mergeSorted from 'stream-join/utils/merge-sorted.js';
```

### `pickFirst() → 0`

Constant-time picker. Takes no arguments; always returns `0`. Pair with `sortedInsert` for k-way merge of sorted streams.

### `pickMin(lessFn) → (items) => number`

**Parameters.** `lessFn(a, b)` — comparator on item values; returns `true` if `a` should come before `b`.

**Returns** a picker function suitable for `select`'s `pick` option. Takes `items: readonly Slot<T>[]` and returns the index of the slot whose `item` is smallest per `lessFn`. Ties resolve to the first occurrence. O(items.length) per call, no allocations.

### `sortedInsert(lessFn) → (items, newSlot, lastPos?) => void`

**Parameters.** `lessFn(a, b)` — comparator on item values; returns `true` if `a` should come before `b`.

**Returns** an `insert` callback suitable for `select`'s `insert` option. Takes `items: Slot<T>[]`, `newSlot: Slot<T>`, and `lastPos?: number`; mutates `items` in place to maintain sorted order. Built on [`nano-binary-search`](https://www.npmjs.com/package/nano-binary-search). Smart-replace optimization: when the new slot belongs at the same position as the just-removed one, replaces in place (one assignment, no splice).

### `mergeSorted(streams, lessFn, options?) → Readable`

**Parameters.**

- `streams` — non-empty array of object-mode `Readable` streams (each sorted per `lessFn`, or locally disordered within `windowSize`).
- `lessFn(a, b)` — comparator on item values; returns `true` if `a` should come before `b`.
- `options` — optional. `ReadableOptions` plus `windowSize?` (default `1`; larger values tolerate local disorder).

**Returns** an object-mode `Readable` emitting the merged sequence in sorted order. Umbrella for `select + pickFirst + sortedInsert(lessFn)`. Equivalent to:

```js
select(streams, {...options, pick: pickFirst, insert: sortedInsert(lessFn)});
```

`lessFn(a, b)` always compares item values (not slots) across all helpers; helpers unwrap `slot.item` internally so the same comparator is reusable across helpers.

### K-way merge of sorted streams

```js
import mergeSorted from 'stream-join/utils/merge-sorted.js';

mergeSorted([sortedStream1, sortedStream2, sortedStream3], (a, b) => a.timestamp < b.timestamp).on(
  'data',
  x => console.log(x)
);
```

### Drift-tolerant merge

```js
mergeSorted([s1, s2], (a, b) => a < b, {windowSize: 4});
```

## Composition with `stream-chain`

Every main component returns a plain `Readable`, so it slots naturally as the first item in a [`stream-chain`](https://www.npmjs.com/package/stream-chain) pipeline:

```js
import chain from 'stream-chain';
import zip from 'stream-join';

chain([
  zip([Readable.from([1, 2, 3]), Readable.from([10, 20, 30])]),
  ([a, b]) => a + b,
  x => x * 2
]).on('data', x => console.log(x));
// 22, 44, 66
```

## Errors

Errors from any input stream are propagated to the output with the **original error value preserved**. On the Node side this is the output Readable's `'error'` event; on the Web side it surfaces via the `ReadableStream` controller's `error()` signal (visible to readers as a rejected `read()`). The runtime pullers from `stream-chain` v4 are non-destructive and preserve raw error values — no `AbortError` wrapping.

## What this package is not for

- **Sorting** — that's [`stream-sorting`](#)'s job (forthcoming).
- **Key-based SQL-style joins** — `mergeJoin` will live in `stream-sorting` (forthcoming); requires sorted-by-key inputs.
- **Set operations** (union / intersection / difference) on sorted streams — same, `stream-sorting`.
- **1→N operations** — that's [`stream-fork`](https://www.npmjs.com/package/stream-fork).

`stream-join`'s primitives don't know about sortedness, keys, or anything domain-specific. They just combine N streams into 1.

## Documentation

Per-component reference and worked examples live in the [wiki](https://github.com/uhop/stream-join/wiki):

- [zip](https://github.com/uhop/stream-join/wiki/zip)
- [select](https://github.com/uhop/stream-join/wiki/select)
- [race](https://github.com/uhop/stream-join/wiki/race)
- [concat](https://github.com/uhop/stream-join/wiki/concat)
- [utils (helpers)](https://github.com/uhop/stream-join/wiki/utils)

## Release History

- 2.0.0 _Multi-component package (`zip` / `select` / `race` / `concat`) rebuilt on `stream-chain` ^4.0.2. ESM-only (`"type": "module"`). Two-tree Node + Web split — `import 'stream-join'` for Node Streams, `import 'stream-join/web'` for Web Streams. Helpers under `src/utils/` (`pickFirst`, `pickMin`, `sortedInsert`, `mergeSorted`). Requires Node 22+. Fleet-standard layout, AI docs, `tape-six` tests, JS + `.d.ts` sidecars. `skipEvents` accepted as no-op for backwards compat._
- 1.0.1 _Technical release, no need to upgrade._
- 1.0.0 _The initial release._

The full release notes are in the wiki: [Release notes](https://github.com/uhop/stream-join/wiki/Release-notes).
