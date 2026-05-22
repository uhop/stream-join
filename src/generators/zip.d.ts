// Internal: pure generator factory shape consumed by `src/zip.js` (Node) and
// `src/web/zip.js` (Web). The public types (`JoinSink`, `JoinItems`,
// `JoinOptions`) live on `../zip.js` / `../web/zip.js`.

/**
 * Sink object passed to `joinItems`. Calling `push(value)` queues `value` for
 * emission as the next yielded item.
 *
 * @typeParam T — element type of values pushed through the sink.
 */
export interface ZipSink<T = unknown> {
  push(value: T): void;
}

/**
 * Options accepted by `zipGen`. Public wrappers extend this with
 * `ReadableOptions` / Web `QueuingStrategy` fields the runtime cares about.
 *
 * @typeParam T — element type of output values.
 */
export interface ZipGenOptions<T = unknown> {
  joinItems?: (sink: ZipSink<T>, items: readonly (unknown | null)[]) => void | Promise<void>;
}

/**
 * Pure async-generator factory for `zip`. Returns a 0-arg generator function;
 * calling it once produces the async iterator that the runtime wrapper hands
 * to `readableFrom` / `ReadableStream.from`.
 *
 * @typeParam T — element type of output values.
 * @param pullers — non-empty array of async iterators (any object satisfying
 *   the `AsyncIterator` shape — both Node's `streamPuller` and Web's
 *   `webStreamPuller` qualify). Validation is the wrapper's responsibility;
 *   `zipGen` trusts its inputs.
 * @param options — accepts `joinItems`; ignores anything else.
 * @returns a 0-arg async-generator function.
 */
declare function zipGen<T = unknown>(
  pullers: readonly AsyncIterator<unknown>[],
  options?: ZipGenOptions<T>
): () => AsyncGenerator<T, void, unknown>;

export default zipGen;
export {zipGen};
