/**
 * Joins an array of `ReadableStream`s into a single `ReadableStream`. On each round, one
 * value is pulled from every non-ended input stream; values from ended streams are
 * represented as `null`. The optional `joinItems` callback combines per-round values into
 * 0 or more output values (and may be `async` — its return value is awaited only if it is
 * a thenable, so synchronous callbacks pay no microtask cost).
 *
 * Two call forms:
 * - `zip(streams, options?)` — output element type is the per-stream tuple (`null` for ended streams).
 * - `zip<T>(streams, options)` — output element type is `T`, supplied explicitly when a custom
 *   `joinItems` reshapes the per-round values.
 *
 * Throws `TypeError` if `streams` is missing, not an array, or empty.
 *
 * @typeParam T — element type emitted by the output `ReadableStream`. Defaults to the per-stream tuple.
 * @typeParam S — the tuple type of input streams. Inferred from the `streams` argument; supply
 *   explicitly to recover positional tuple typing on `JoinItems<S>`.
 * @param streams — non-empty array of `ReadableStream`s.
 * @param options — optional. `joinItems` plus the legacy `skipEvents` flag.
 * @returns a `ReadableStream<T>` that emits combined values. Propagates errors from any input
 *   stream; closes when every input stream has closed.
 */
declare function zip<
  T = readonly (unknown | null)[],
  const S extends readonly ReadableStream<unknown>[] = readonly ReadableStream<unknown>[]
>(streams: S, options?: zip.JoinOptions<T, S>): ReadableStream<T>;

declare namespace zip {
  /**
   * Resolves to the value type of a `ReadableStream` — `R` for `ReadableStream<R>`, otherwise `unknown`.
   *
   * @typeParam R — a `ReadableStream<V>` whose value type to extract.
   */
  export type StreamValue<R> = R extends ReadableStream<infer V> ? V : unknown;

  /**
   * Tuple of per-stream values aligned positionally with the input `streams` tuple. Each entry
   * is the corresponding stream's value type or `null` (if that stream has ended).
   *
   * @typeParam S — the tuple type of input streams.
   */
  export type JoinItems<S extends readonly ReadableStream<unknown>[]> = {
    readonly [K in keyof S]: StreamValue<S[K]> | null;
  };

  /**
   * Sink passed to the `joinItems` callback. The callback calls `sink.push(value)` 0 or more
   * times per round; every pushed value becomes a separate output emission.
   *
   * @typeParam T — element type of values pushed through the sink.
   */
  export interface JoinSink<T> {
    /**
     * Emit one value through the output `ReadableStream`. May be called 0 or more times per round.
     *
     * @param value — the value to emit. Passed through as-is to the underlying stream.
     * @returns nothing.
     */
    push(value: T): void;
  }

  /**
   * Options accepted by `zip()` (Web variant).
   *
   * @typeParam T — element type of the output `ReadableStream`.
   * @typeParam S — the tuple type of input streams.
   */
  export interface JoinOptions<
    T = readonly (unknown | null)[],
    S extends readonly ReadableStream<unknown>[] = readonly ReadableStream<unknown>[]
  > {
    /**
     * Combine function called once per round with the values from each input stream (in the same
     * positional order as `streams`). `null` indicates the corresponding stream has ended. Push 0
     * or more output values via `sink.push(value)`. May be `async`: a returned thenable is
     * awaited before the next round starts.
     *
     * Default: `(sink, items) => sink.push(items)`.
     */
    joinItems?: (sink: JoinSink<T>, items: JoinItems<S>) => void | Promise<void>;

    /**
     * Accepted for backwards compatibility with the Node-side 1.x. No-op — errors from input
     * streams are always propagated to the output.
     *
     * @deprecated since 2.0.0
     */
    skipEvents?: boolean;
  }
}

type StreamValue<R> = zip.StreamValue<R>;
type JoinItems<S extends readonly ReadableStream<unknown>[]> = zip.JoinItems<S>;
type JoinSink<T> = zip.JoinSink<T>;
type JoinOptions<
  T = readonly (unknown | null)[],
  S extends readonly ReadableStream<unknown>[] = readonly ReadableStream<unknown>[]
> = zip.JoinOptions<T, S>;

export default zip;
export {zip};
export type {StreamValue, JoinItems, JoinSink, JoinOptions};
