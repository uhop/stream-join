// @ts-self-types="./select.d.ts"

// Node wrapper for `select`. Adapts `Readable[]` → async-iterator pullers
// via stream-chain's `streamPuller`, runs the shared `selectGen` factory,
// returns the result as a Node Readable via stream-chain's `readableFrom`.

import readableFrom from 'stream-chain/utils/readableFrom.js';
import makeStreamPuller from 'stream-chain/utils/streamPuller.js';

import selectGen from './generators/select.js';

const select = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError("select's first argument should be a non-empty array of Readable streams.");
  }
  if (!options || typeof options.pick != 'function') {
    throw TypeError("select's options.pick must be a function.");
  }
  const windowSize = options.windowSize === undefined ? 1 : options.windowSize;
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw TypeError("select's options.windowSize must be a positive integer.");
  }

  const pullers = streams.map(s => makeStreamPuller(s));

  const readableOpts = {...options};
  delete readableOpts.pick;
  delete readableOpts.insert;
  delete readableOpts.remove;
  delete readableOpts.windowSize;

  return readableFrom({
    ...readableOpts,
    iterable: selectGen(pullers, options),
    objectMode: true
  });
};

export default select;
export {select};
