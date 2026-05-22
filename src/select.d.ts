/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from 'stream-chain/typed-streams.js';

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
 * Throws `TypeError` if `streams` is missing/empty, `options.pick` is missing or not a function,
 * or `options.windowSize` is not a positive integer.
 *
 * @typeParam S — the tuple type of input streams.
 * @param streams — non-empty array of object-mode Readable streams.
 * @param options — required. Must include `pick`; may include `insert`, `remove`, `windowSize`,
 *   plus any `ReadableOptions`.
 * @returns a `TypedReadable<SlotItemType<S>>` that emits one value per round. Always object-mode.
 *   Propagates `'error'` events from any input stream; ends when every input stream has ended
 *   (or `pick` returns a stop signal).
 */
declare function select<const S extends readonly Readable[] = readonly Readable[]>(
  streams: S,
  options: select.SelectOptions<S>
): TypedReadable<select.SlotItemType<S>>;

declare namespace select {
  /**
   * Resolves to the value type of a `Readable` — `R` for `TypedReadable<R>`, otherwise `unknown`.
   *
   * @typeParam R — a `Readable` (or `TypedReadable<V>`) whose value type to extract.
   */
  export type StreamValue<R> = R extends TypedReadable<infer V> ? V : unknown;

  /**
   * Union of value types across the input streams tuple. For homogeneous inputs this resolves to
   * the single shared value type; for heterogeneous inputs, it's the union.
   *
   * @typeParam S — the tuple type of input streams.
   */
  export type SlotItemType<S extends readonly Readable[]> = StreamValue<S[number]>;

  /**
   * An entry in the buffer the picker / inserter / remover sees.
   *
   * @typeParam T — the value type carried by this slot.
   */
  export interface Slot<T> {
    /** The value pulled from the source stream. */
    item: T;
    /** The position of the source stream in the input `streams` array. */
    index: number;
  }

  /**
   * Options accepted by `select()`. Extends `ReadableOptions`; the output Readable is always
   * created with `objectMode: true`.
   *
   * @typeParam S — the tuple type of input streams (used to type the slots passed to the hooks).
   */
  export interface SelectOptions<
    S extends readonly Readable[] = readonly Readable[]
  > extends ReadableOptions {
    /**
     * Required. Given the current buffer of slots, returns the index of the slot to emit and refill.
     *
     * The return value MUST be an integer in `[0, items.length)`. Any other value
     * (`undefined`, `null`, `NaN`, ±`Infinity`, negative, non-integer, ≥ length)
     * stops the merge — useful for early termination.
     *
     * @param items — read-only view of the current buffer (length depends on `windowSize`,
     *   number of streams, and how many have exhausted).
     * @returns the index of the slot to emit, or any non-integer / out-of-range value to stop.
     */
    pick: (items: readonly Slot<SlotItemType<S>>[]) => number;

    /**
     * Optional. Places a freshly-pulled slot into `items` (mutates in place). Called both during
     * the parallel initial fill (`lastPos === undefined`, length MAY grow) and during steady-state
     * refill (`lastPos` defined, length MUST stay unchanged).
     *
     * Default: replace at `lastPos` (or `push` when `lastPos` is undefined).
     *
     * @param items — the mutable buffer to update in place.
     * @param newSlot — the freshly-pulled slot to insert.
     * @param lastPos — `undefined` during initial fill (grow the buffer); otherwise the index
     *   of the slot just emitted (refill in place, no length change).
     * @returns nothing.
     */
    insert?: (
      items: Slot<SlotItemType<S>>[],
      newSlot: Slot<SlotItemType<S>>,
      lastPos?: number
    ) => void;

    /**
     * Optional. Called when the source stream of `items[lastPos]` has just exhausted; the hook
     * MUST decrease `items.length` by 1. Default: `items.splice(lastPos, 1)`.
     *
     * @param items — the mutable buffer; the hook must shorten it by 1.
     * @param lastPos — index of the slot whose source stream has exhausted.
     * @returns nothing.
     */
    remove?: (items: Slot<SlotItemType<S>>[], lastPos: number) => void;

    /**
     * Optional. Per-stream buffer depth — how many items from each stream the initial fill
     * pre-buffers, and the steady-state buffer length per stream. Default `1`. Must be a
     * positive integer.
     */
    windowSize?: number;
  }
}

type StreamValue<R> = select.StreamValue<R>;
type SlotItemType<S extends readonly Readable[]> = select.SlotItemType<S>;
type Slot<T> = select.Slot<T>;
type SelectOptions<S extends readonly Readable[] = readonly Readable[]> = select.SelectOptions<S>;

export default select;
export {select};
export type {StreamValue, SlotItemType, Slot, SelectOptions};
