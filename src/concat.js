// @ts-self-types="./concat.d.ts"

// Node wrapper for `concat`. Adapts `Readable[]` → puller factories via
// stream-chain's `streamPuller` (lazy — each puller is created when its
// stream's turn arrives), runs the shared `concatGen` factory, returns the
// result as a Node Readable via stream-chain's `readableFrom`.

import readableFrom from 'stream-chain/utils/readableFrom.js';
import makeStreamPuller from 'stream-chain/utils/streamPuller.js';

import concatGen from './generators/concat.js';

const concat = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError("concat's first argument should be a non-empty array of Readable streams.");
  }

  const opts = options || {};
  const pullerFactories = streams.map(s => () => makeStreamPuller(s));

  return readableFrom({
    ...opts,
    iterable: concatGen(pullerFactories, opts),
    objectMode: true
  });
};

export default concat;
export {concat};
