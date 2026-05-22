// Internal: pure generator factory shape consumed by `src/race.js` (Node)
// and `src/web/race.js` (Web). The public types live on `../race.js` /
// `../web/race.js`.

/**
 * Pure async-generator factory for `race`. Returns a 0-arg generator
 * function; calling it once produces the async iterator the runtime wrapper
 * hands to `readableFrom` / `ReadableStream.from`.
 *
 * @typeParam T — element type of output values.
 * @param pullers — non-empty array of async iterators. Validation is the
 *   wrapper's responsibility; `raceGen` trusts its inputs.
 * @param options — currently unused; reserved for future per-component
 *   options.
 * @returns a 0-arg async-generator function.
 */
declare function raceGen<T = unknown>(
  pullers: readonly AsyncIterator<T>[],
  options?: unknown
): () => AsyncGenerator<T, void, unknown>;

export default raceGen;
export {raceGen};
