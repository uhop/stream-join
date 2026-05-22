// @ts-self-types="./race.d.ts"

// Web wrapper for `race`. Adapts `ReadableStream[]` → async-iterator pullers
// via stream-chain's `webStreamPuller`, runs the shared `raceGen` factory,
// returns the result as a Web `ReadableStream` via `fromAsyncIterable`
// (a portable shim for `ReadableStream.from`).

import makeWebStreamPuller from 'stream-chain/utils/webStreamPuller.js';

import raceGen from '../generators/race.js';
import fromAsyncIterable from './from-async-iterable.js';

const race = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError(
      "race's first argument should be a non-empty array of ReadableStream instances."
    );
  }

  const opts = options || {};
  const pullers = streams.map(s => makeWebStreamPuller(s));

  return fromAsyncIterable(raceGen(pullers, opts)());
};

export default race;
export {race};
