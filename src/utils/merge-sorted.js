// @ts-self-types="./merge-sorted.d.ts"

'use strict';

const select = require('../select.js');
const pickFirst = require('./pick-first.js');
const sortedInsert = require('./sorted-insert.js');

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

module.exports = mergeSorted;
