export = pickFirst;

/**
 * Picker that always returns `0`. The right partner for `sortedInsert` — when the buffer is
 * maintained in sorted order, the slot to emit is always at index 0, so the picker is O(1)
 * with zero comparisons.
 *
 * @returns the integer `0`, regardless of input.
 */
declare const pickFirst: () => number;
