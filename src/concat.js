// @ts-self-types="./concat.d.ts"

'use strict';

const readableFrom = require('stream-chain/utils/readableFrom.js');
const makeStreamPuller = require('./stream-puller.js');

// N→1 sequential concatenation: drains stream 0 fully, then stream 1, …,
// then stream N-1. Pullers are created lazily, one at a time, so streams
// that haven't started yet aren't buffering data prematurely.

const concat = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError("concat's first argument should be a non-empty array of Readable streams.");
  }

  const opts = options || {};
  const n = streams.length;

  async function* generator() {
    for (let i = 0; i < n; ++i) {
      const puller = makeStreamPuller(streams[i]);
      try {
        while (true) {
          const r = await puller.next();
          if (r.done) break;
          yield r.value;
        }
      } finally {
        puller.close();
      }
    }
  }

  return readableFrom({
    ...opts,
    iterable: generator,
    objectMode: true
  });
};

module.exports = concat;
