/**
 * Portable equivalent of `ReadableStream.from(asyncIterable)`. Implemented
 * via `new ReadableStream({pull, cancel})` for runtimes that don't yet ship
 * the static factory method (Bun 1.3.14 is the current outlier among
 * Node 22+ / Bun / Deno).
 *
 * Internal — not part of the public API.
 *
 * @typeParam T — value type of the underlying iterable.
 * @param iterable — an `AsyncIterable<T>` or `AsyncIterator<T>`.
 * @returns a `ReadableStream<T>` that pulls one value per consumer demand
 *   and closes when the iterable signals done.
 */
declare function fromAsyncIterable<T>(
  iterable: AsyncIterable<T> | AsyncIterator<T>
): ReadableStream<T>;

export default fromAsyncIterable;
export {fromAsyncIterable};
