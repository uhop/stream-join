// @ts-self-types="./zip.d.ts"

// Web wrapper for `zip`. Adapts `ReadableStream[]` → async-iterator pullers
// via stream-chain's `webStreamPuller`, runs the shared `zipGen` factory,
// returns the result as a Web `ReadableStream` via `fromAsyncIterable`
// (a portable shim for `ReadableStream.from`).

import makeWebStreamPuller from 'stream-chain/utils/webStreamPuller.js';

import zipGen from '../generators/zip.js';
import fromAsyncIterable from './from-async-iterable.js';

const zip = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError(
      "zip's first argument should be a non-empty array of ReadableStream instances."
    );
  }

  const opts = options || {};
  const pullers = streams.map(s => makeWebStreamPuller(s));

  return fromAsyncIterable(zipGen(pullers, opts)());
};

export default zip;
export {zip};
