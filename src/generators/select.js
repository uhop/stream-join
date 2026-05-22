// @ts-self-types="./select.d.ts"

// Pure generator factory for `select`. Runtime-neutral — drives any
// async-iterator pullers. Both `src/select.js` (Node) and `src/web/select.js`
// (Web) consume this; the per-runtime puller adapter and output-stream wrap
// are supplied by the wrapper. Internal — the public surface lives on the
// wrapper files.

const defaultInsert = (items, newSlot, lastPos) => {
  if (lastPos === undefined) items.push(newSlot);
  else items[lastPos] = newSlot;
};

const defaultRemove = (items, lastPos) => items.splice(lastPos, 1);

const selectGen = (pullers, options) => {
  const opts = options;
  const pick = opts.pick;
  const insert = typeof opts.insert == 'function' ? opts.insert : defaultInsert;
  const remove = typeof opts.remove == 'function' ? opts.remove : defaultRemove;
  const windowSize = opts.windowSize === undefined ? 1 : opts.windowSize;
  const n = pullers.length;

  return async function* generator() {
    const exhausted = new Array(n).fill(false);
    const items = [];

    try {
      // Initial fill: per-stream sequential, cross-stream concurrent. Total
      // wait is the slowest stream's `windowSize` pulls, not the sum.
      // `insert` is serialized between awaits by JS single-threading — no
      // race on the shared `items` mutation.
      await Promise.all(
        pullers.map(async (puller, streamIndex) => {
          for (let i = 0; i < windowSize; ++i) {
            const r = await puller.next();
            if (r.done) {
              exhausted[streamIndex] = true;
              return;
            }
            insert(items, {item: r.value, index: streamIndex}, undefined);
          }
        })
      );

      // Steady state.
      while (items.length > 0) {
        const pos = pick(items);
        // Stop signals: anything not in [0, items.length) — undefined, null,
        // NaN, ±Infinity, negatives, non-integers, >= length.
        // `Number.isInteger` returns false for all the bad cases.
        if (!Number.isInteger(pos) || pos < 0 || pos >= items.length) return;

        const slot = items[pos];
        const streamIndex = slot.index;
        yield slot.item;

        if (exhausted[streamIndex]) {
          remove(items, pos);
          continue;
        }
        const r = await pullers[streamIndex].next();
        if (r.done) {
          exhausted[streamIndex] = true;
          remove(items, pos);
        } else {
          insert(items, {item: r.value, index: streamIndex}, pos);
        }
      }
    } finally {
      for (let i = 0; i < n; ++i) {
        if (typeof pullers[i]?.return == 'function') pullers[i].return();
      }
    }
  };
};

export default selectGen;
export {selectGen};
