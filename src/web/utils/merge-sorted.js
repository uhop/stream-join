// @ts-self-types="./merge-sorted.d.ts"

import select from '../select.js';
import pickFirst from '../../utils/pick-first.js';
import sortedInsert from '../../utils/sorted-insert.js';

// Headline k-way-merge helper, Web variant: wires `pickFirst + sortedInsert(lessFn)`
// so the output is a sorted merge of the input `ReadableStream`s. With
// `windowSize > 1` the caller tolerates per-stream local disorder up to that
// window. Mirrors `src/utils/merge-sorted.js` against the Web `select`.

const mergeSorted = (streams, lessFn, options) =>
  select(streams, {
    ...options,
    pick: pickFirst,
    insert: sortedInsert(lessFn)
  });

export default mergeSorted;
export {mergeSorted};
