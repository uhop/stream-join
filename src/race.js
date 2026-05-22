// @ts-self-types="./race.d.ts"

// Node wrapper for `race`. Adapts `Readable[]` → async-iterator pullers via
// stream-chain's `streamPuller`, runs the shared `raceGen` factory, returns
// the result as a Node Readable via stream-chain's `readableFrom`.

import readableFrom from 'stream-chain/utils/readableFrom.js';
import makeStreamPuller from 'stream-chain/utils/streamPuller.js';

import raceGen from './generators/race.js';

const race = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError("race's first argument should be a non-empty array of Readable streams.");
  }

  const opts = options || {};
  const pullers = streams.map(s => makeStreamPuller(s));

  return readableFrom({
    ...opts,
    iterable: raceGen(pullers, opts),
    objectMode: true
  });
};

export default race;
export {race};
