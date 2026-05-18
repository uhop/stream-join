/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from 'stream-chain/typed-streams.js';

export = join;

/**
 * Joins an array of object-mode Readable streams into a single object-mode Readable. On each
 * round, one value is pulled from every non-ended input stream; values from ended streams are
 * represented as `null`. The optional `joinItems` callback combines per-round values into 0 or
 * more output values (and may be `async` — its return value is awaited only if it is a
 * thenable, so synchronous callbacks pay no microtask cost).
 *
 * Two call forms:
 * - `join(streams, options?)` — output type is the per-stream tuple (`null` for ended streams).
 * - `join<T>(streams, options)` — output type is `T`, supplied explicitly when a custom
 *   `joinItems` reshapes the per-round values.
 *
 * @param streams non-empty array of object-mode Readable streams
 * @param options Readable options plus `joinItems`
 * @returns a Readable stream that produces the combined values
 */
declare function join<
  T = readonly (unknown | null)[],
  const S extends readonly Readable[] = readonly Readable[]
>(streams: S, options?: join.JoinOptions<T, S>): TypedReadable<T>;

declare namespace join {
  /**
   * Resolves to the value type of a `Readable` — `R` for `TypedReadable<R>`, otherwise `unknown`.
   */
  export type StreamValue<R> = R extends TypedReadable<infer V> ? V : unknown;

  /**
   * Tuple of per-stream values aligned positionally with the input `streams` tuple. Each entry
   * is the corresponding stream's value type or `null` (if that stream has ended).
   */
  export type JoinItems<S extends readonly Readable[]> = {
    readonly [K in keyof S]: StreamValue<S[K]> | null;
  };

  /**
   * Sink passed to `joinItems`. Call `push(value)` 0 or more times per round.
   */
  export interface JoinSink<T> {
    push(value: T): void;
  }

  /**
   * Options accepted by `join()`. Extends `ReadableOptions`; the readable is always
   * `objectMode: true`.
   */
  export interface JoinOptions<
    T = readonly (unknown | null)[],
    S extends readonly Readable[] = readonly Readable[]
  > extends ReadableOptions {
    /**
     * Combine function called once per round with the values from each input stream (in the same
     * positional order as `streams`). `null` indicates the corresponding stream has ended. Push 0
     * or more output values via `sink.push(value)`. May be `async`: a returned thenable is
     * awaited before the next round starts.
     *
     * Default: `(sink, items) => sink.push(items)`.
     *
     * **Note on `items` lifetime:** the array is owned by `join()` and is only valid for the
     * duration of the `joinItems` call. The default implementation pushes the array by
     * reference, which is safe because `join()` allocates a fresh `items` array every round. If
     * a custom `joinItems` wants to retain the array past its return, it must copy it.
     */
    joinItems?: (sink: JoinSink<T>, items: JoinItems<S>) => void | Promise<void>;

    /**
     * Accepted for backwards compatibility with stream-join 1.x. No-op in 2.x — errors from input
     * streams are always propagated to the output via the async-iterator path.
     * @deprecated since 2.0.0
     */
    skipEvents?: boolean;
  }
}
