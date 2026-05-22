// @ts-self-types="./sorted-insert.d.ts"

import binarySearch from 'nano-binary-search';

// Maintains `items` in sorted order per `lessFn`. Smart-replace optimization:
// when the new slot belongs at the same logical position as the just-removed
// one, replaces in place (one assignment, no splice). Otherwise: two splices
// in an order that preserves the insertion index.
//
// `lessFn(a, b)` compares item *values* (not slots); the helper unwraps
// `slot.item` internally so the same comparator can be reused with `pickMin`.

const sortedInsert = lessFn => (items, newSlot, lastPos) => {
  // Predicate compatible with nano-binary-search: returns true while we want
  // to search to the right of the candidate (i.e., candidate is less than newSlot).
  const pred = slot => lessFn(slot.item, newSlot.item);

  if (lastPos === undefined) {
    // Initial fill: binary-search and splice in.
    items.splice(binarySearch(items, pred), 0, newSlot);
    return;
  }

  // Post-pick refill: find where newSlot belongs in the full array (with
  // items[lastPos] still present, since it'll be either replaced or spliced).
  const pos = binarySearch(items, pred);

  // Smart-replace check: does newSlot belong exactly where items[lastPos] is?
  //   pos === lastPos       → newSlot belongs immediately before items[lastPos]
  //   pos === lastPos + 1   → newSlot belongs immediately after items[lastPos]
  // In either case, if we remove items[lastPos] and reinsert newSlot, it lands
  // at lastPos. Single assignment, no splice.
  if (pos === lastPos || pos === lastPos + 1) {
    items[lastPos] = newSlot;
    return;
  }

  // Otherwise: two splices, in an order that preserves the insertion index.
  if (pos < lastPos) {
    // Insert first (shifts lastPos to lastPos+1), then remove the old.
    items.splice(pos, 0, newSlot);
    items.splice(lastPos + 1, 1);
  } else {
    // pos > lastPos + 1: remove first (pulls higher indices down by 1),
    // then insert at pos-1.
    items.splice(lastPos, 1);
    items.splice(pos - 1, 0, newSlot);
  }
};

export default sortedInsert;
export {sortedInsert};
