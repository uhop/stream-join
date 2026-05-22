/**
 * Combines N `ReadableStream`s into a single `ReadableStream` by selecting one of N currently
 * buffered slots per round, emitting it, refilling that slot from its source stream, and
 * looping until every stream is exhausted (or `pick` signals stop).
 *
 * Different from `zip()`: `zip` advances all N streams per round and combines the values;
 * `select` advances ONE stream per round and emits one item. K-way merge of sorted streams,
 * priority-queue merge, and drift-tolerant merge are all `select` use cases.
 *
 * Throws `TypeError` if `streams` is missing/empty, `options.pick` is missing or not a function,
 * or `options.windowSize` is not a positive integer.
 *
 * @typeParam S — the tuple type of input streams.
 * @param streams — non-empty array of `ReadableStream`s.
 * @param options — required. Must include `pick`; may include `insert`, `remove`, `windowSize`.
 * @returns a `ReadableStream<SlotItemType<S>>` that emits one value per round.
 */
declare function select<
  const S extends readonly ReadableStream<unknown>[] = readonly ReadableStream<unknown>[]
>(streams: S, options: select.SelectOptions<S>): ReadableStream<select.SlotItemType<S>>;

declare namespace select {
  /**
   * Resolves to the value type of a `ReadableStream` — `R` for `ReadableStream<R>`, otherwise `unknown`.
   *
   * @typeParam R — a `ReadableStream<V>` whose value type to extract.
   */
  export type StreamValue<R> = R extends ReadableStream<infer V> ? V : unknown;

  /**
   * Union of value types across the input streams tuple.
   *
   * @typeParam S — the tuple type of input streams.
   */
  export type SlotItemType<S extends readonly ReadableStream<unknown>[]> = StreamValue<S[number]>;

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
   * Options accepted by `select()` (Web variant).
   *
   * @typeParam S — the tuple type of input streams.
   */
  export interface SelectOptions<
    S extends readonly ReadableStream<unknown>[] = readonly ReadableStream<unknown>[]
  > {
    /**
     * Required. Given the current buffer of slots, returns the index of the slot to emit and
     * refill. Any non-integer / out-of-range return value stops the merge.
     */
    pick: (items: readonly Slot<SlotItemType<S>>[]) => number;

    /**
     * Optional. Places a freshly-pulled slot into `items` (mutates in place).
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

type StreamValue<R> = select.StreamValue<R>;
type SlotItemType<S extends readonly ReadableStream<unknown>[]> = select.SlotItemType<S>;
type Slot<T> = select.Slot<T>;
type SelectOptions<
  S extends readonly ReadableStream<unknown>[] = readonly ReadableStream<unknown>[]
> = select.SelectOptions<S>;

export default select;
export {select};
export type {StreamValue, SlotItemType, Slot, SelectOptions};
