declare namespace pickMin {
  /**
   * An entry in the buffer the picker sees. Same shape as `select.Slot<T>`.
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
 * Returns a picker that selects the slot with the smallest item per `lessFn`. O(items.length)
 * per pick, no allocations, branch-predictable. `lessFn` compares item **values** (not slots);
 * the helper unwraps `slot.item` internally so the same comparator can be reused with
 * `sortedInsert`.
 *
 * @typeParam T — the value type carried by the slots.
 * @param lessFn — comparator. Returns `true` if `a` should come before `b` (i.e., `a < b`).
 *   Must be a strict-weak-order predicate.
 * @returns a picker function suitable for `select()`'s `pick` option. The picker takes a
 *   read-only buffer of `Slot<T>` and returns the index of the slot with the smallest item.
 *   Ties resolve to the first occurrence.
 */
declare function pickMin<T>(
  lessFn: (a: T, b: T) => boolean
): (items: readonly pickMin.Slot<T>[]) => number;

type Slot<T> = pickMin.Slot<T>;

export default pickMin;
export {pickMin};
export type {Slot};
