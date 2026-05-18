/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from 'stream-chain/typed-streams.js';

export = join;

/**
 * Joins an array of object-mode Readable streams into a single object-mode Readable. On each
 * round, one value is pulled from every non-ended input stream; values from ended streams are
 * represented as `null`. The optional `joinItems` callback combines per-round values into 0 or
 * more output values.
 *
 * @param streams non-empty array of object-mode Readable streams
 * @param options Readable options plus `joinItems`
 * @returns a Readable stream that produces the combined values
 */
declare function join<T = readonly (unknown | null)[]>(
  streams: readonly Readable[],
  options?: join.JoinOptions<T>
): TypedReadable<T>;

declare namespace join {
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
  export interface JoinOptions<T = readonly (unknown | null)[]> extends ReadableOptions {
    /**
     * Combine function called once per round with the values from each input stream (in the same
     * positional order as `streams`). `null` indicates the corresponding stream has ended. Push 0
     * or more output values via `sink.push(value)`. Default: `(sink, items) => sink.push(items)`.
     */
    joinItems?: (sink: JoinSink<T>, items: ReadonlyArray<unknown | null>) => void;

    /**
     * Accepted for backwards compatibility with stream-join 1.x. No-op in 2.x — errors from input
     * streams are always propagated to the output via the async-iterator path.
     * @deprecated since 2.0.0
     */
    skipEvents?: boolean;
  }
}
