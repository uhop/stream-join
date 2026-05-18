// @ts-self-types="./index.d.ts"

'use strict';

const readableFrom = require('stream-chain/utils/readableFrom.js');

const defaultJoinItems = (sink, items) => sink.push(items);

const join = (streams, options) => {
  if (!Array.isArray(streams) || !streams.length) {
    throw TypeError("join's first argument should be a non-empty array of Readable streams.");
  }

  const opts = options || {};
  const joinItems = typeof opts.joinItems == 'function' ? opts.joinItems : defaultJoinItems;

  async function* zip() {
    // Node's async-iterator-on-Readable rejects pending `.next()` calls with AbortError after
    // destroying the stream. The original error is lost from the iterator's perspective —
    // capture it via a side-listener attached *before* iterators are created so we surface the
    // real cause downstream.
    const errors = streams.map(() => null);
    const handlers = streams.map((s, i) => {
      const h = error => {
        if (!errors[i]) errors[i] = error;
      };
      s.on('error', h);
      return h;
    });

    try {
      const iters = streams.map(s => s[Symbol.asyncIterator]());
      const ended = streams.map(() => false);

      while (true) {
        const items = streams.map(() => null);
        let allDone = true;

        let results;
        try {
          results = await Promise.all(iters.map((it, i) => (ended[i] ? null : it.next())));
        } catch (error) {
          throw errors.find(e => e) || error;
        }
        for (let i = 0; i < results.length; ++i) {
          const r = results[i];
          if (r === null) continue;
          if (r.done) {
            ended[i] = true;
          } else {
            items[i] = r.value;
            allDone = false;
          }
        }
        if (allDone) return;

        const collected = [];
        joinItems({push: value => collected.push(value)}, items);
        for (const value of collected) yield value;
      }
    } finally {
      streams.forEach((s, i) => s.off('error', handlers[i]));
    }
  }

  const readableOpts = {...opts};
  delete readableOpts.joinItems;
  delete readableOpts.skipEvents;

  return readableFrom({
    ...readableOpts,
    iterable: zip,
    objectMode: true
  });
};

module.exports = join;
