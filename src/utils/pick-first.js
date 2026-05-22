// @ts-self-types="./pick-first.d.ts"

// Always picks the first slot. The right partner for `sortedInsert` — when the
// buffer is maintained in sorted order, the slot to emit is always at index 0,
// so the picker is O(1) with zero comparisons.

const pickFirst = () => 0;

export default pickFirst;
export {pickFirst};
