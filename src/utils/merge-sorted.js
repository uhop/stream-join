// @ts-self-types="./merge-sorted.d.ts"

import select from '../select.js';
import pickFirst from './pick-first.js';
import sortedInsert from './sorted-insert.js';

// Headline k-way-merge helper: wires `pickFirst + sortedInsert(lessFn)` so the
// output is a sorted merge of the input streams. With `windowSize > 1` the
// caller tolerates per-stream local disorder up to that window.
//
// `lessFn(a, b)` compares item *values* — the same predicate works with
// `pickMin` and `sortedInsert` directly if the caller wants more control.

const mergeSorted = (streams, lessFn, options) =>
  select(streams, {
    ...options,
    pick: pickFirst,
    insert: sortedInsert(lessFn)
  });

export default mergeSorted;
export {mergeSorted};
