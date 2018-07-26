# stream-chain

[![Build status][travis-image]][travis-url]
[![Dependencies][deps-image]][deps-url]
[![devDependencies][dev-deps-image]][dev-deps-url]
[![NPM version][npm-image]][npm-url]

`stream-join` is a function, which takes an array of object mode [Readable](https://nodejs.org/api/stream.html#stream_readable_streams) streams and returns a combined object mode `Readable` stream of arrays, which pack together corresponding values from input streams, while properly handling [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams/).

Originally `stream-join` was used with [stream-json](https://www.npmjs.com/package/stream-json) to create flexible data processing pipelines, but can be used stand-alone.

`stream-join` is a lightweight, no-dependencies micro-package. It is distributed under New BSD license.

## Intro

`stream-join` creates a stream of arrays of values. The first array contains the first values of all streams and the `N`th value comes from the `N`th stream. Their respective order doesn't matter. The second array will contain the second values of all streams. And so on. If the corresponding stream has ended, `null` is going to be used as its value (object mode streams cannot use `null` values because it indicates the end-of-stream). The resulting stream will end when all streams have ended.

```js
const join = require('stream-join');

const {PassThrough} = require('stream-join/tests/helpers');

const s1 = new PassThrough(), s2 = new PassThrough(),
  result = join([s1, s2]);

result.on('data', data => console.log(data));

// all streams are written asynchronously
s2.write('a');
s1.write(1);
s1.write(2);
s2.write('b');
s1.write(3);
s2.end();
s1.write(4);
s1.end();

// prints:
// [1, 'a']
// [2, 'b']
// [3, null] // s2 has ended
// [4, null]
```

## Installation

```bash
npm i --save stream-join
# or: yarn add stream-join
```

## Documentation

The module returns a function, whose prototype is:

```js
const join = require('stream-join');

const result = join(streams[, options]);
```

Where:

* `streams` is an array of object mode [Readable](https://nodejs.org/api/stream.html#stream_readable_streams) streams.
* `options` is an optional object detailed in the [Node's documentation](https://nodejs.org/api/stream.html#stream_new_stream_readable_options) used to create `result`.
  * The following properties are always overridden:
    * `objectMode` is always `true`.
    * `read()` is replaced with an internal implementation.
  * The following custom properties are recognized:
    * `skipEvents` is an optional flag. If it is falsy (the default), `'error'` events from all streams are forwarded to `result`. If it is truthy, no event forwarding is made. A user can always do so manually.
* `result` is an object mode [Readable](https://nodejs.org/api/stream.html#stream_readable_streams) stream, which produces combined values.

## Release History

- 1.0.0 *The initial release.*

[npm-image]:      https://img.shields.io/npm/v/stream-join.svg
[npm-url]:        https://npmjs.org/package/stream-join
[deps-image]:     https://img.shields.io/david/uhop/stream-join.svg
[deps-url]:       https://david-dm.org/uhop/stream-join
[dev-deps-image]: https://img.shields.io/david/dev/uhop/stream-join.svg
[dev-deps-url]:   https://david-dm.org/uhop/stream-join?type=dev
[travis-image]:   https://img.shields.io/travis/uhop/stream-join.svg
[travis-url]:     https://travis-ci.org/uhop/stream-join
[definitelytyped-image]: https://img.shields.io/badge/DefinitelyTyped-.d.ts-blue.svg
[definitelytyped-url]:   https://definitelytyped.org
