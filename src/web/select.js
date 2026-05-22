// @ts-self-types="./select.d.ts"

// Web wrapper for `select`. Adapts `ReadableStream[]` → async-iterator pullers
// via stream-chain's `webStreamPuller`, runs the shared `selectGen` factory,
// returns the result as a Web `ReadableStream` via `fromAsyncIterable`
// (a portable shim for `ReadableStream.from`).

import makeWebStreamPuller from 'stream-chain/utils/webStreamPuller.js';

import selectGen from '../generators/select.js';
import fromAsyncIterable from './from-async-iterable.js';

const select = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError(
      "select's first argument should be a non-empty array of ReadableStream instances."
    );
  }
  if (!options || typeof options.pick != 'function') {
    throw TypeError("select's options.pick must be a function.");
  }
  const windowSize = options.windowSize === undefined ? 1 : options.windowSize;
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw TypeError("select's options.windowSize must be a positive integer.");
  }

  const pullers = streams.map(s => makeWebStreamPuller(s));

  return fromAsyncIterable(selectGen(pullers, options)());
};

export default select;
export {select};
