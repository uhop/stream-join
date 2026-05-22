// @ts-self-types="./race.d.ts"

// Pure generator factory for `race`. Runtime-neutral — drives any
// async-iterator pullers. Both `src/race.js` (Node) and `src/web/race.js`
// (Web) consume this; the per-runtime puller adapter and output-stream wrap
// are supplied by the wrapper. Internal — the public surface lives on the
// wrapper files.

const raceGen = (pullers, _options) => {
  const n = pullers.length;

  return async function* generator() {
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
      for (let i = 0; i < n; ++i) {
        if (typeof pullers[i]?.return == 'function') pullers[i].return();
      }
    }
  };
};

export default raceGen;
export {raceGen};
