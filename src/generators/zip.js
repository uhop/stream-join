// @ts-self-types="./zip.d.ts"

// Pure generator factory for `zip`. Runtime-neutral — drives any async-iterator
// pullers. Both `src/zip.js` (Node) and `src/web/zip.js` (Web) consume this;
// the per-runtime puller adapter and output-stream wrap are supplied by the
// wrapper. Internal — the public surface lives on the wrapper files.

const defaultJoinItems = (sink, items) => sink.push(items);

const zipGen = (pullers, options) => {
  const opts = options || {};
  const joinItems = typeof opts.joinItems == 'function' ? opts.joinItems : defaultJoinItems;
  const n = pullers.length;

  return async function* generator() {
    // Pre-allocate hot-loop scratch space. Per-round costs multiply by stream
    // cardinality, so reuse arrays, the sink object, and the push-closure
    // across rounds.
    const ended = new Array(n).fill(false);
    const pendingResults = new Array(n);
    const collected = [];
    const sink = {push: value => collected.push(value)};

    try {
      while (true) {
        // `items` MUST be allocated per round: the default `joinItems` pushes
        // it by reference to the consumer; reusing would alias the
        // previously-yielded array.
        const items = new Array(n).fill(null);
        let allDone = true;

        for (let i = 0; i < n; ++i) {
          pendingResults[i] = ended[i] ? null : pullers[i].next();
        }
        const results = await Promise.all(pendingResults);
        for (let i = 0; i < n; ++i) {
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

        collected.length = 0;
        // Conditional await: sync `joinItems` pays just a typeof check (no
        // microtask tick); async ones are awaited correctly.
        const ret = joinItems(sink, items);
        if (typeof ret?.then == 'function') await ret;
        for (let i = 0, m = collected.length; i < m; ++i) yield collected[i];
      }
    } finally {
      for (let i = 0; i < n; ++i) {
        if (typeof pullers[i]?.return == 'function') pullers[i].return();
      }
    }
  };
};

export default zipGen;
export {zipGen};
