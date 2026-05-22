// Internal: pure generator factory shape consumed by `src/concat.js` (Node)
// and `src/web/concat.js` (Web). The public types live on `../concat.js` /
// `../web/concat.js`.

/**
 * Pure async-generator factory for `concat`. Returns a 0-arg generator
 * function; calling it once produces the async iterator the runtime wrapper
 * hands to `readableFrom` / `ReadableStream.from`.
 *
 * Distinct from `zipGen` / `selectGen` / `raceGen`: takes an array of puller
 * **factories**, invoked just-in-time as each stream's turn arrives. This
 * preserves the lazy puller-attachment guarantee — later streams don't
 * engage until earlier ones exhaust.
 *
 * @typeParam T — element type of output values.
 * @param pullerFactories — non-empty array of `() => AsyncIterator<T>`
 *   functions. Validation is the wrapper's responsibility.
 * @param options — currently unused; reserved for future per-component
 *   options.
 * @returns a 0-arg async-generator function.
 */
declare function concatGen<T = unknown>(
  pullerFactories: readonly (() => AsyncIterator<T>)[],
  options?: unknown
): () => AsyncGenerator<T, void, unknown>;

export default concatGen;
export {concatGen};
