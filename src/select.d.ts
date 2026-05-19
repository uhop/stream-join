/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from 'stream-chain/typed-streams.js';

export = select;

/**
 * Combines N object-mode Readable streams into a single Readable by selecting one of N currently
 * buffered slots per round, emitting it, refilling that slot from its source stream, and looping
 * until every stream is exhausted (or `pick` signals stop).
 *
 * Different from `zip()`: `zip` advances all N streams per round and combines the values; `select`
 * advances ONE stream per round and emits one item. K-way merge of sorted streams, priority-queue
 * merge, and drift-tolerant merge are all `select` use cases.
 *
 * The output element type is the union of the input streams' value types (`SlotItemType<S>`).
 * For homogeneous input — e.g., `TypedReadable<T>[]` — the output is `TypedReadable<T>`. For
 * heterogeneous input or untyped `Readable[]`, it's the union or `unknown`.
 *
 * @param streams non-empty array of object-mode Readable streams
 * @param options must include `pick`; may include `insert`, `remove`, `windowSize`, plus any `ReadableOptions`
 */
declare function select<const S extends readonly Readable[] = readonly Readable[]>(
  streams: S,
  options: select.SelectOptions<S>
): TypedReadable<select.SlotItemType<S>>;

declare namespace select {
  /**
   * Resolves to the value type of a `Readable` — `R` for `TypedReadable<R>`, otherwise `unknown`.
   */
  export type StreamValue<R> = R extends TypedReadable<infer V> ? V : unknown;

  /**
   * Union of value types across the input streams tuple. For homogeneous inputs this resolves to
   * the single shared value type; for heterogeneous inputs, it's the union.
   */
  export type SlotItemType<S extends readonly Readable[]> = StreamValue<S[number]>;

  /**
   * An entry in the buffer the picker / inserter / remover sees.
   */
  export interface Slot<T> {
    /** The value pulled from the source stream. */
    item: T;
    /** The position of the source stream in the `streams` array. */
    index: number;
  }

  export interface SelectOptions<
    S extends readonly Readable[] = readonly Readable[]
  > extends ReadableOptions {
    /**
     * Required. Given the current buffer of slots, returns the index of the slot to emit and refill.
     *
     * The return value MUST be an integer in `[0, items.length)`. Any other value
     * (`undefined`, `null`, `NaN`, ±`Infinity`, negative, non-integer, ≥ length)
     * stops the merge — useful for early termination.
     */
    pick: (items: readonly Slot<SlotItemType<S>>[]) => number;

    /**
     * Optional. Places a freshly-pulled slot into `items` (mutates in place). Called both during
     * the parallel initial fill (`lastPos === undefined`, length MAY grow) and during steady-state
     * refill (`lastPos` defined, length MUST stay unchanged).
     *
     * Default: replace at `lastPos` (or `push` when `lastPos` is undefined).
     */
    insert?: (
      items: Slot<SlotItemType<S>>[],
      newSlot: Slot<SlotItemType<S>>,
      lastPos?: number
    ) => void;

    /**
     * Optional. Called when the source stream of `items[lastPos]` has just exhausted; the hook
     * MUST decrease `items.length` by 1. Default: `items.splice(lastPos, 1)`.
     */
    remove?: (items: Slot<SlotItemType<S>>[], lastPos: number) => void;

    /**
     * Optional. Per-stream buffer depth. Default `1`. Must be a positive integer.
     */
    windowSize?: number;
  }
}
