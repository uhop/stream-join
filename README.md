# stream-join [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/stream-join.svg
[npm-url]: https://npmjs.org/package/stream-join

`stream-join` is a toolkit of N→1 stream combinators — functions that take an array of object-mode [Readable](https://nodejs.org/api/stream.html#stream_readable_streams) streams and return a single object-mode `Readable`, with proper [backpressure](https://nodejs.org/en/learn/modules/backpressuring-in-streams) handling. Four primitives cover the useful control-flow shapes:

- **`zip`** — symmetric advance: one value per non-ended stream per round, combined via `joinItems`
- **`select`** — asymmetric advance: a user-defined `pick` chooses one slot per round from a buffer
- **`race`** — emit-as-ready: whichever stream's data resolves first wins
- **`concat`** — sequential drain: stream 0, then 1, …, then N-1

Plus a small set of helpers under [`stream-join/utils/`](#helpers) for composing common merge patterns (k-way merge of sorted streams, priority-queue merge, drift-tolerant merge).

`stream-join` is a lightweight micro-package built on [`stream-chain`](https://www.npmjs.com/package/stream-chain) and [`nano-binary-search`](https://www.npmjs.com/package/nano-binary-search) — its only runtime dependencies. It is distributed under New BSD license.

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
import select from 'stream-join/select';
import race from 'stream-join/race';
import concat from 'stream-join/concat';
import mergeSorted from 'stream-join/utils/merge-sorted';
```

## The four primitives

### `zip(streams, options?)` — symmetric N-round combine

Per round, pulls one value from every non-ended input stream concurrently. Values from ended streams are represented as `null`. The optional `joinItems` callback combines per-round values into zero or more output values (default: emit the items array as one value).

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

After a parallel initial fill of up to `windowSize` items per stream, the user's `pick(items)` returns the index of the slot to emit each round. The picked slot's source stream is refilled (default: replace in place) or removed if exhausted.

```js
import select from 'stream-join/select';
import pickMin from 'stream-join/utils/pick-min';

// Priority-queue merge: emit the smallest available value each round
select([Readable.from([1, 4, 7]), Readable.from([2, 5, 8]), Readable.from([3, 6, 9])], {
  pick: pickMin((a, b) => a < b)
}).on('data', x => console.log(x));
// 1, 2, 3, 4, 5, 6, 7, 8, 9
```

The `windowSize` option (default `1`) tolerates local disorder in input streams — the picker can see up to `N × windowSize` candidates per round and recover global ordering even when individual streams have local jitter.

Stop signal: `pick` returning anything outside `[0, items.length)` (negative, `NaN`, `undefined`, `null`, ≥ length) ends the merge.

### `race(streams, options?)` — emit-as-ready

Whichever input stream resolves first wins each round. No buffering across rounds. Natural fit for merging live event streams where the output shouldn't be bounded by the slowest source.

```js
import race from 'stream-join/race';

race([logStreamA, logStreamB, logStreamC]).on('data', event => process(event));
```

Output order is non-deterministic — it reflects how the input streams' data events interleave in the event loop.

### `concat(streams, options?)` — sequential drain

Stream 0 is fully drained, then stream 1, …, then stream N-1. Pullers are created lazily, one stream at a time, so streams that haven't started yet don't pre-buffer.

```js
import concat from 'stream-join/concat';

concat([part1, part2, part3]).on('data', chunk => collect(chunk));
```

## Helpers

```js
import pickFirst from 'stream-join/utils/pick-first';
import pickMin from 'stream-join/utils/pick-min';
import sortedInsert from 'stream-join/utils/sorted-insert';
import mergeSorted from 'stream-join/utils/merge-sorted';
```

- **`pickFirst`** — `() => 0`. Constant-time picker. Pair with `sortedInsert` for k-way merge.
- **`pickMin(lessFn)`** — linear-scan picker. Returns index of the smallest item per `lessFn`.
- **`sortedInsert(lessFn)`** — maintains the slot buffer in sorted order via [`nano-binary-search`](https://www.npmjs.com/package/nano-binary-search). Smart-replace optimization: when the new slot belongs at the same position as the just-removed one, replaces in place (one assignment, no splice).
- **`mergeSorted(streams, lessFn, options?)`** — umbrella combining `select + pickFirst + sortedInsert`. K-way merge of sorted streams in one line.

`lessFn(a, b)` always compares item values (not slots); helpers unwrap `slot.item` internally so the same comparator is reusable across helpers.

### K-way merge of sorted streams

```js
import mergeSorted from 'stream-join/utils/merge-sorted';

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

Errors from any input stream are propagated to the output's `'error'` event with the **original error value preserved**. The package's internal stream-puller listens for `'error'` directly; no `AbortError` wrapping that Node's `Readable[Symbol.asyncIterator]()` introduces.

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

- 2.0.0 _Rebuilt on `stream-chain`. Requires Node 22+. Fleet-standard layout, AI docs, `tape-six` tests, JS + `.d.ts` sidecars. `skipEvents` accepted as no-op for backwards compat._
- 1.0.1 _Technical release, no need to upgrade._
- 1.0.0 _The initial release._

The full release notes are in the wiki: [Release notes](https://github.com/uhop/stream-join/wiki/Release-notes).
