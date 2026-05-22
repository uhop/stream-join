// @ts-self-types="./zip.d.ts"

// Node wrapper for `zip`. Adapts `Readable[]` → async-iterator pullers via
// stream-chain's `streamPuller`, runs the shared `zipGen` factory, returns
// the result as a Node Readable via stream-chain's `readableFrom`.

import readableFrom from 'stream-chain/utils/readableFrom.js';
import makeStreamPuller from 'stream-chain/utils/streamPuller.js';

import zipGen from './generators/zip.js';

const zip = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError("zip's first argument should be a non-empty array of Readable streams.");
  }

  const opts = options || {};
  const pullers = streams.map(s => makeStreamPuller(s));

  const readableOpts = {...opts};
  delete readableOpts.joinItems;
  delete readableOpts.skipEvents;

  return readableFrom({
    ...readableOpts,
    iterable: zipGen(pullers, opts),
    objectMode: true
  });
};

export default zip;
export {zip};
