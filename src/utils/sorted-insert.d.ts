export = sortedInsert;

declare namespace sortedInsert {
  export interface Slot<T> {
    item: T;
    index: number;
  }
}

/**
 * Returns an `insert` callback that maintains the buffer in sorted order per `lessFn`.
 *
 * Built on `nano-binary-search`. On post-pick refill, detects when the new slot
 * belongs at the same logical position as the just-removed one and does an
 * in-place replace (one assignment instead of two splices) — the common case
 * when the source streams are themselves locally sorted.
 *
 * @param lessFn returns `true` if `a` should come before `b`
 * @returns a function suitable for `select()`'s `insert` option
 */
declare function sortedInsert<T>(
  lessFn: (a: T, b: T) => boolean
): (items: sortedInsert.Slot<T>[], newSlot: sortedInsert.Slot<T>, lastPos?: number) => void;
