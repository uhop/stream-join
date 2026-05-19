// @ts-self-types="./pick-min.d.ts"

'use strict';

// Linear scan for the smallest item per `lessFn`. O(items.length) per pick,
// no allocations, branch-predictable. `lessFn` compares item *values* (not
// slots); the helper unwraps `slot.item` internally so the same comparator
// can be reused with `sortedInsert`.

const pickMin = lessFn => items => {
  let min = 0;
  for (let i = 1; i < items.length; ++i) {
    if (lessFn(items[i].item, items[min].item)) min = i;
  }
  return min;
};

module.exports = pickMin;
