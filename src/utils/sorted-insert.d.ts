declare namespace sortedInsert {
  /**
   * An entry in the buffer the inserter mutates. Same shape as `select.Slot<T>`.
   *
   * @typeParam T — the value type carried by this slot.
   */
  export interface Slot<T> {
    /** The value pulled from the source stream. */
    item: T;
    /** The position of the source stream in the input `streams` array. */
    index: number;
  }
}

/**
 * Returns an `insert` callback that maintains the buffer in sorted order per `lessFn`.
 *
 * Built on `nano-binary-search`. On post-pick refill, detects when the new slot belongs at
 * the same logical position as the just-removed one and does an in-place replace (one
 * assignment instead of two splices) — the common case when the source streams are
 * themselves locally sorted.
 *
 * @typeParam T — the value type carried by the slots.
 * @param lessFn — comparator. Returns `true` if `a` should come before `b` (i.e., `a < b`).
 *   Must be a strict-weak-order predicate.
 * @returns an `insert` function suitable for `select()`'s `insert` option. The function takes:
 *   - `items` — the mutable buffer to update in place;
 *   - `newSlot` — the freshly-pulled slot to insert;
 *   - `lastPos` — `undefined` during initial fill (grow the buffer), or the index of the slot
 *     just emitted (refill in place, length unchanged).
 *
 *   Returns nothing; mutates `items` in place to maintain sorted order.
 */
declare function sortedInsert<T>(
  lessFn: (a: T, b: T) => boolean
): (items: sortedInsert.Slot<T>[], newSlot: sortedInsert.Slot<T>, lastPos?: number) => void;

type Slot<T> = sortedInsert.Slot<T>;

export default sortedInsert;
export {sortedInsert};
export type {Slot};
