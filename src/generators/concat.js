// @ts-self-types="./concat.d.ts"

// Pure generator factory for `concat`. Runtime-neutral — drives any
// async-iterator pullers. Both `src/concat.js` (Node) and `src/web/concat.js`
// (Web) consume this; the per-runtime puller adapter and output-stream wrap
// are supplied by the wrapper. Internal — the public surface lives on the
// wrapper files.
//
// Distinct from the other generators: `concat` takes an array of puller
// **factories** rather than pre-made pullers. Each factory is invoked
// just-in-time when its stream's turn arrives — preserves the lazy
// puller-attachment guarantee (later streams aren't engaged until earlier
// ones exhaust).

const concatGen = (pullerFactories, _options) => {
  const n = pullerFactories.length;

  return async function* generator() {
    for (let i = 0; i < n; ++i) {
      const puller = pullerFactories[i]();
      try {
        while (true) {
          const r = await puller.next();
          if (r.done) break;
          yield r.value;
        }
      } finally {
        if (typeof puller?.return == 'function') puller.return();
      }
    }
  };
};

export default concatGen;
export {concatGen};
