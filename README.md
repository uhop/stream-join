# stream-join [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/stream-join.svg
[npm-url]: https://npmjs.org/package/stream-join

`stream-join` joins values from multiple object-mode [Readable](https://nodejs.org/api/stream.html#stream_readable_streams) streams into a single object-mode `Readable`, while properly handling [backpressure](https://nodejs.org/en/learn/modules/backpressuring-in-streams). Per round, one value is pulled from each non-ended input; ended streams contribute `null`. An optional `joinItems` callback combines per-round values into zero or more output values.

`stream-join` is a lightweight micro-package built on [`stream-chain`](https://www.npmjs.com/package/stream-chain) — its sole runtime dependency. It is distributed under New BSD license.

## Installation

```bash
npm i stream-join
```

## Usage

```js
import join from 'stream-join';
import {Readable} from 'node:stream';

const s1 = Readable.from([1, 2, 3]);
const s2 = Readable.from(['a', 'b', 'c']);

const result = join([s1, s2]);
result.on('data', data => console.log(data));

// prints:
// [1, 'a']
// [2, 'b']
// [3, 'c']
```

When the input streams have different lengths, ended streams contribute `null`:

```js
const s1 = Readable.from([1, 2, 3, 4]);
const s2 = Readable.from(['a', 'b']);

join([s1, s2]).on('data', data => console.log(data));
// prints:
// [1, 'a']
// [2, 'b']
// [3, null]   // s2 has ended
// [4, null]
```

Custom output via `joinItems`:

```js
const s1 = Readable.from([1, 2, 3]);
const s2 = Readable.from(['a', 'b']);

const result = join([s1, s2], {
  joinItems(sink, items) {
    items.forEach(item => {
      if (item !== null) sink.push(item);
    });
  }
});

result.on('data', data => console.log(data));
// prints: 1, 'a', 2, 'b', 3
```

## Composition with `stream-chain`

`join()` returns a plain `Readable`, so it slots naturally as the first item in a [`stream-chain`](https://www.npmjs.com/package/stream-chain) pipeline:

```js
import chain from 'stream-chain';
import join from 'stream-join';
import {Readable} from 'node:stream';

const pipeline = chain([
  join([Readable.from([1, 2, 3]), Readable.from([10, 20, 30])]),
  ([a, b]) => a + b,
  x => x * 2
]);

pipeline.on('data', x => console.log(x));
// prints: 22, 44, 66
```

## API

```js
import join from 'stream-join';

const result = join(streams[, options]);
```

- `streams` — non-empty array of object-mode [Readable](https://nodejs.org/api/stream.html#stream_readable_streams) streams.
- `options` — optional. Passed through to the underlying [Readable](https://nodejs.org/api/stream.html#new-streamreadableoptions); `objectMode` is always `true`. Plus:
  - `joinItems(sink, items)` — optional. Called once per round.
    - `sink.push(value)` may be called 0 or more times.
    - `items` is an array of values, one per stream in positional order. `null` means that stream has ended.
    - Default: `(sink, items) => sink.push(items)`.
- Returns: an object-mode `Readable` that emits the combined values.

Errors from any input stream are propagated to the output's `'error'` event with the original error (Node's iterator-AbortError wrapper is unwrapped internally).

## Documentation

Detailed docs live in the [wiki](https://github.com/uhop/stream-join/wiki).

## Release History

- 2.0.0 _Rebuilt on `stream-chain`. Requires Node 22+. Fleet-standard layout, AI docs, `tape-six` tests, JS + `.d.ts` sidecars. `skipEvents` accepted as no-op for backwards compat._
- 1.0.1 _Technical release, no need to upgrade._
- 1.0.0 _The initial release._

The full release notes are in the wiki: [Release notes](https://github.com/uhop/stream-join/wiki/Release-notes).
