/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from 'stream-chain/typed-streams.js';

export = mergeSorted;

/**
 * K-way merge of object-mode Readable streams using `pickFirst + sortedInsert(lessFn)`.
 * Output is sorted per `lessFn` if each input stream is itself sorted per `lessFn`.
 *
 * With `options.windowSize > 1`, the merge tolerates up to that many items of local disorder
 * per input stream — the picker sees `N × windowSize` candidates and recovers the true global
 * minimum at each step.
 *
 * Equivalent to:
 *
 * ```js
 * select(streams, {...options, pick: pickFirst, insert: sortedInsert(lessFn)})
 * ```
 *
 * @typeParam T — the value type carried by every input stream (homogeneous input is assumed —
 *   the comparator can't compare values of different types).
 * @param streams — non-empty array of object-mode Readable streams, each sorted per `lessFn`
 *   (or locally disordered within `windowSize`).
 * @param lessFn — comparator. Returns `true` if `a` should come before `b` (i.e., `a < b`).
 *   Must be a strict-weak-order predicate.
 * @param options — optional. Standard `ReadableOptions` plus the optional `windowSize` property.
 * @returns a `TypedReadable<T>` that emits the merged sequence in sorted order. Propagates
 *   `'error'` events from any input stream; ends when every input stream has ended.
 */
declare function mergeSorted<T>(
  streams: readonly Readable[],
  lessFn: (a: T, b: T) => boolean,
  options?: mergeSorted.MergeSortedOptions
): TypedReadable<T>;

declare namespace mergeSorted {
  /**
   * Options accepted by `mergeSorted()`. Extends `ReadableOptions`; adds only `windowSize`.
   * The output Readable is always created with `objectMode: true`.
   */
  export interface MergeSortedOptions extends ReadableOptions {
    /**
     * Per-stream buffer depth. Default `1`. Must be a positive integer. With `windowSize > 1`,
     * up to that many items of local disorder per input stream are tolerated.
     */
    windowSize?: number;
  }
}
