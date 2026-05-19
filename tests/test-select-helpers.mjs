'use strict';

import test from 'tape-six';

import pickFirst from '../src/utils/pick-first.js';
import pickMin from '../src/utils/pick-min.js';
import sortedInsert from '../src/utils/sorted-insert.js';

const slot = (item, index = 0) => ({item, index});

test('pickFirst: always returns 0', t => {
  t.equal(pickFirst(), 0);
  t.equal(pickFirst(), 0);
});

test('pickMin: returns index of smallest item by lessFn', t => {
  const items = [slot(5), slot(2), slot(8), slot(1), slot(4)];
  const pick = pickMin((a, b) => a < b);
  t.equal(pick(items), 3);
});

test('pickMin: ties — returns first occurrence', t => {
  const items = [slot(5), slot(2), slot(8), slot(2), slot(4)];
  const pick = pickMin((a, b) => a < b);
  t.equal(pick(items), 1);
});

test('pickMin: single-item array returns 0', t => {
  t.equal(pickMin((a, b) => a < b)([slot(42)]), 0);
});

test('sortedInsert: initial fill builds sorted array', t => {
  const insert = sortedInsert((a, b) => a < b);
  const items = [];
  insert(items, slot(5), undefined);
  insert(items, slot(2), undefined);
  insert(items, slot(8), undefined);
  insert(items, slot(1), undefined);
  t.deepEqual(
    items.map(s => s.item),
    [1, 2, 5, 8]
  );
});

test('sortedInsert: smart replace — new slot belongs at the same position as removed', t => {
  const insert = sortedInsert((a, b) => a < b);
  const items = [slot(1, 0), slot(3, 1), slot(5, 2)];
  // Remove items[1] (value 3) and insert value 4. 4 belongs between 3's neighbors (1 and 5),
  // so it lands at index 1 — same slot.
  insert(items, slot(4, 3), 1);
  t.equal(items.length, 3);
  t.deepEqual(
    items.map(s => s.item),
    [1, 4, 5]
  );
  t.equal(items[1].index, 3); // confirm we got the new slot, not the old
});

test('sortedInsert: refill — new slot belongs before removed position', t => {
  const insert = sortedInsert((a, b) => a < b);
  const items = [slot(2, 0), slot(5, 1), slot(8, 2)];
  // Remove items[2] (value 8) and insert value 3. 3 belongs at index 1 (between 2 and 5).
  insert(items, slot(3, 3), 2);
  t.equal(items.length, 3);
  t.deepEqual(
    items.map(s => s.item),
    [2, 3, 5]
  );
});

test('sortedInsert: refill — new slot belongs after removed position', t => {
  const insert = sortedInsert((a, b) => a < b);
  const items = [slot(2, 0), slot(5, 1), slot(8, 2)];
  // Remove items[0] (value 2) and insert value 7. 7 belongs at index 1 (between 5 and 8).
  insert(items, slot(7, 3), 0);
  t.equal(items.length, 3);
  t.deepEqual(
    items.map(s => s.item),
    [5, 7, 8]
  );
});

test('sortedInsert: stress — many random replacements stay sorted', t => {
  const insert = sortedInsert((a, b) => a < b);
  const items = [];
  // Build sorted via initial fill
  for (const v of [3, 7, 1, 9, 5, 11, 2]) insert(items, slot(v), undefined);
  let sorted = items.map(s => s.item).slice();
  sorted.sort((a, b) => a - b);
  t.deepEqual(
    items.map(s => s.item),
    sorted
  );

  // 50 random replacements
  for (let i = 0; i < 50; ++i) {
    const lastPos = Math.floor(Math.random() * items.length);
    const newVal = Math.floor(Math.random() * 100);
    insert(items, slot(newVal), lastPos);
    const vals = items.map(s => s.item);
    const expected = vals.slice().sort((a, b) => a - b);
    t.deepEqual(vals, expected);
  }
});
