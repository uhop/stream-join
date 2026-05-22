/**
 * K-way merge of `ReadableStream`s using `pickFirst + sortedInsert(lessFn)`. Output is
 * sorted per `lessFn` if each input stream is itself sorted per `lessFn`.
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
 * Mirrors `stream-join/utils/merge-sorted.js` against the Web `select`.
 *
 * @typeParam T — the value type carried by every input stream (homogeneous input is assumed).
 * @param streams — non-empty array of `ReadableStream`s, each sorted per `lessFn` (or locally
 *   disordered within `windowSize`).
 * @param lessFn — comparator. Returns `true` if `a` should come before `b` (i.e., `a < b`).
 *   Must be a strict-weak-order predicate.
 * @param options — optional. May include the `windowSize` property.
 * @returns a `ReadableStream<T>` that emits the merged sequence in sorted order.
 */
declare function mergeSorted<T>(
  streams: readonly ReadableStream<T>[],
  lessFn: (a: T, b: T) => boolean,
  options?: mergeSorted.MergeSortedOptions
): ReadableStream<T>;

declare namespace mergeSorted {
  /**
   * Options accepted by `mergeSorted()` (Web variant). Adds only `windowSize`.
   */
  export interface MergeSortedOptions {
    /**
     * Per-stream buffer depth. Default `1`. Must be a positive integer. With `windowSize > 1`,
     * up to that many items of local disorder per input stream are tolerated.
     */
    windowSize?: number;
  }
}

type MergeSortedOptions = mergeSorted.MergeSortedOptions;

export default mergeSorted;
export {mergeSorted};
export type {MergeSortedOptions};
