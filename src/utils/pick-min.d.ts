export = pickMin;

declare namespace pickMin {
  export interface Slot<T> {
    item: T;
    index: number;
  }
}

/**
 * Returns a picker that selects the slot with the smallest item per `lessFn`.
 *
 * @param lessFn returns `true` if `a` should come before `b`
 * @returns a function suitable for `select()`'s `pick` option
 */
declare function pickMin<T>(
  lessFn: (a: T, b: T) => boolean
): (items: readonly pickMin.Slot<T>[]) => number;
