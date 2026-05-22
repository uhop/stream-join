// @ts-self-types="./concat.d.ts"

// Web wrapper for `concat`. Adapts `ReadableStream[]` → puller factories via
// stream-chain's `webStreamPuller` (lazy — each puller is created when its
// stream's turn arrives), runs the shared `concatGen` factory, returns the
// result as a Web `ReadableStream` via `fromAsyncIterable` (a portable shim
// for `ReadableStream.from`).

import makeWebStreamPuller from 'stream-chain/utils/webStreamPuller.js';

import concatGen from '../generators/concat.js';
import fromAsyncIterable from './from-async-iterable.js';

const concat = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError(
      "concat's first argument should be a non-empty array of ReadableStream instances."
    );
  }

  const opts = options || {};
  const pullerFactories = streams.map(s => () => makeWebStreamPuller(s));

  return fromAsyncIterable(concatGen(pullerFactories, opts)());
};

export default concat;
export {concat};
