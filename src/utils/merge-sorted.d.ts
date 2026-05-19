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
 * @param streams non-empty array of object-mode Readable streams
 * @param lessFn returns `true` if `a` should come before `b`
 * @param options optional ReadableOptions + `windowSize`
 */
declare function mergeSorted<T>(
  streams: readonly Readable[],
  lessFn: (a: T, b: T) => boolean,
  options?: mergeSorted.MergeSortedOptions
): TypedReadable<T>;

declare namespace mergeSorted {
  export interface MergeSortedOptions extends ReadableOptions {
    /** Per-stream buffer depth. Default `1`. */
    windowSize?: number;
  }
}
