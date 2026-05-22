/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from 'stream-chain/typed-streams.js';

/**
 * Joins an array of object-mode Readable streams into a single object-mode Readable. On each
 * round, one value is pulled from every non-ended input stream; values from ended streams are
 * represented as `null`. The optional `joinItems` callback combines per-round values into 0 or
 * more output values (and may be `async` — its return value is awaited only if it is a
 * thenable, so synchronous callbacks pay no microtask cost).
 *
 * Two call forms:
 * - `zip(streams, options?)` — output element type is the per-stream tuple (`null` for ended streams).
 * - `zip<T>(streams, options)` — output element type is `T`, supplied explicitly when a custom
 *   `joinItems` reshapes the per-round values.
 *
 * Throws `TypeError` if `streams` is missing, not an array, or empty.
 *
 * @typeParam T — element type emitted by the output Readable. Defaults to the per-stream tuple.
 * @typeParam S — the tuple type of input streams. Inferred from the `streams` argument; supply
 *   explicitly to recover positional tuple typing on `JoinItems<S>`.
 * @param streams — non-empty array of object-mode Readable streams. Each may be a plain
 *   `Readable` or a `TypedReadable<V>` for per-stream value typing.
 * @param options — optional. Standard `ReadableOptions` plus the `joinItems` and (legacy)
 *   `skipEvents` properties.
 * @returns a `TypedReadable<T>` that emits combined values. Always object-mode. Propagates
 *   `'error'` events from any input stream; ends when every input stream has ended.
 */
declare function zip<
  T = readonly (unknown | null)[],
  const S extends readonly Readable[] = readonly Readable[]
>(streams: S, options?: zip.JoinOptions<T, S>): TypedReadable<T>;

declare namespace zip {
  /**
   * Resolves to the value type of a `Readable` — `R` for `TypedReadable<R>`, otherwise `unknown`.
   *
   * @typeParam R — a `Readable` (or `TypedReadable<V>`) whose value type to extract.
   */
  export type StreamValue<R> = R extends TypedReadable<infer V> ? V : unknown;

  /**
   * Tuple of per-stream values aligned positionally with the input `streams` tuple. Each entry
   * is the corresponding stream's value type or `null` (if that stream has ended).
   *
   * @typeParam S — the tuple type of input streams.
   */
  export type JoinItems<S extends readonly Readable[]> = {
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
     * Emit one value through the output Readable. May be called 0 or more times per round.
     *
     * @param value — the value to emit. No type or shape coercion is applied; passed through
     *   as-is to the underlying Readable.
     * @returns nothing.
     */
    push(value: T): void;
  }

  /**
   * Options accepted by `zip()`. Extends `ReadableOptions`; the output Readable is always
   * created with `objectMode: true` regardless of any value passed here.
   *
   * @typeParam T — element type of the output Readable.
   * @typeParam S — the tuple type of input streams.
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
     * **Note on `items` lifetime:** the array is owned by `zip()` and is only valid for the
     * duration of the `joinItems` call. The default implementation pushes the array by
     * reference, which is safe because `zip()` allocates a fresh `items` array every round. If
     * a custom `joinItems` wants to retain the array past its return, it must copy it.
     *
     * Synchronous throws and rejected return-promises both propagate as `'error'` events on the
     * output Readable.
     *
     * @param sink — output sink. Call `sink.push(value)` 0 or more times per round.
     * @param items — per-stream values for the current round (length equals `streams.length`).
     *   Position `i` is the value from `streams[i]`, or `null` if that stream has ended.
     * @returns `void` for synchronous callbacks, or a `Promise<void>` awaited before the next round.
     */
    joinItems?: (sink: JoinSink<T>, items: JoinItems<S>) => void | Promise<void>;

    /**
     * Accepted for backwards compatibility with stream-join 1.x. No-op in 2.x — errors from input
     * streams are always propagated to the output via the puller's `'error'` event path.
     *
     * @deprecated since 2.0.0
     */
    skipEvents?: boolean;
  }
}

type StreamValue<R> = zip.StreamValue<R>;
type JoinItems<S extends readonly Readable[]> = zip.JoinItems<S>;
type JoinSink<T> = zip.JoinSink<T>;
type JoinOptions<
  T = readonly (unknown | null)[],
  S extends readonly Readable[] = readonly Readable[]
> = zip.JoinOptions<T, S>;

export default zip;
export {zip};
export type {StreamValue, JoinItems, JoinSink, JoinOptions};
