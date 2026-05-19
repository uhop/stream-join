// @ts-self-types="./race.d.ts"

'use strict';

const readableFrom = require('stream-chain/utils/readableFrom.js');
const makeStreamPuller = require('./stream-puller.js');

// N→1 emit-as-ready: emits values from whichever input stream resolves first,
// without buffering across rounds. Different from `select`, which awaits an
// initial fill of all N streams before the first emit; race emits as soon as
// any stream has data.

const race = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError("race's first argument should be a non-empty array of Readable streams.");
  }

  const opts = options || {};
  const n = streams.length;

  async function* generator() {
    const pullers = new Array(n);
    for (let i = 0; i < n; ++i) pullers[i] = makeStreamPuller(streams[i]);

    // Each entry in pendingPulls is either:
    //   - a Promise resolving to {value, done, index}, or
    //   - null (the source stream has ended and won't be raced again).
    const pendingPulls = new Array(n);
    let liveCount = n;
    const tagWithIndex = i => r => {
      r.index = i;
      return r;
    };
    for (let i = 0; i < n; ++i) {
      pendingPulls[i] = pullers[i].next().then(tagWithIndex(i));
    }

    try {
      while (liveCount > 0) {
        // Race only the still-live pulls. The filter allocates one array per
        // round; cheap for typical N, and bounded by I/O cadence anyway.
        const r = await Promise.race(pendingPulls.filter(p => p !== null));
        if (r.done) {
          pendingPulls[r.index] = null;
          --liveCount;
        } else {
          yield r.value;
          pendingPulls[r.index] = pullers[r.index].next().then(tagWithIndex(r.index));
        }
      }
    } finally {
      for (let i = 0; i < n; ++i) pullers[i].close();
    }
  }

  return readableFrom({
    ...opts,
    iterable: generator,
    objectMode: true
  });
};

module.exports = race;
