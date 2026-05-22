// @ts-self-types="./from-async-iterable.d.ts"

// Portable equivalent of `ReadableStream.from(asyncIterable)`. The static
// method was added to WHATWG Streams late — Node 20.6+ and Deno 2 have it,
// Bun 1.3.14 does not. Using `new ReadableStream({pull, cancel})` works on
// every runtime that supports Web Streams at all.
//
// Used by every Web wrapper in this package; not exported publicly.

const fromAsyncIterable = iterable => {
  const iter = iterable[Symbol.asyncIterator] ? iterable[Symbol.asyncIterator]() : iterable;
  return new ReadableStream({
    async pull(controller) {
      try {
        const r = await iter.next();
        if (r.done) controller.close();
        else controller.enqueue(r.value);
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() {
      if (typeof iter.return == 'function') {
        // Fire-and-forget: cancel() can return a Promise, but if return()
        // itself rejects (e.g., the generator's finally throws), we don't
        // want to surface that on the cancel side — the consumer has
        // already given up.
        try {
          iter.return();
        } catch {
          /* ignore */
        }
      }
    }
  });
};

export default fromAsyncIterable;
export {fromAsyncIterable};
