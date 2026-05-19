'use strict';

import test from 'tape-six';

import select from '../src/select.js';
import pickFirst from '../src/utils/pick-first.js';
import pickMin from '../src/utils/pick-min.js';
import sortedInsert from '../src/utils/sorted-insert.js';
import mergeSorted from '../src/utils/merge-sorted.js';

import {streamFromArray, streamToArrayOnce} from './helpers.mjs';

test.asPromise(
  'select: smoke — pickFirst with default insert exhausts streams in order',
  async (t, resolve) => {
    // pickFirst always returns 0. Default insert replaces at lastPos=0 → exhausts items[0]'s
    // source stream first, then items[0] becomes what was items[1] (after the splice when
    // stream 0 ends), and so on. Output is concatenation in stream order.
    const result = select([streamFromArray([1, 2, 3]), streamFromArray([10, 20, 30])], {
      pick: pickFirst
    });
    const output = await streamToArrayOnce(result);
    t.deepEqual(output, [1, 2, 3, 10, 20, 30]);
    resolve();
  }
);

test.asPromise(
  'select: pickMin + default insert gives priority-queue merge',
  async (t, resolve) => {
    // Streams produce values; pickMin selects the smallest item present in the buffer each round.
    const result = select(
      [streamFromArray([1, 4, 7]), streamFromArray([2, 5, 8]), streamFromArray([3, 6, 9])],
      {pick: pickMin((a, b) => a < b)}
    );
    const output = await streamToArrayOnce(result);
    t.deepEqual(output, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    resolve();
  }
);

test.asPromise('select: pickFirst + sortedInsert merges sorted streams', async (t, resolve) => {
  const less = (a, b) => a < b;
  const result = select(
    [
      streamFromArray([1, 4, 7, 10]),
      streamFromArray([2, 5, 8]),
      streamFromArray([3, 6, 9, 12, 15])
    ],
    {pick: pickFirst, insert: sortedInsert(less)}
  );
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15]);
  resolve();
});

test.asPromise('select: mergeSorted umbrella helper', async (t, resolve) => {
  const result = mergeSorted(
    [streamFromArray([1, 4, 7]), streamFromArray([2, 5, 8]), streamFromArray([3, 6, 9])],
    (a, b) => a < b
  );
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  resolve();
});

test.asPromise('select: mergeSorted with mismatched stream lengths', async (t, resolve) => {
  const result = mergeSorted(
    [streamFromArray([1, 10, 100]), streamFromArray([2]), streamFromArray([3, 30])],
    (a, b) => a < b
  );
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2, 3, 10, 30, 100]);
  resolve();
});

test.asPromise('select: mergeSorted with one empty stream', async (t, resolve) => {
  const result = mergeSorted(
    [streamFromArray([1, 4, 7]), streamFromArray([]), streamFromArray([2, 5, 8])],
    (a, b) => a < b
  );
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2, 4, 5, 7, 8]);
  resolve();
});

test.asPromise('select: mergeSorted with all empty streams', async (t, resolve) => {
  const result = mergeSorted(
    [streamFromArray([]), streamFromArray([]), streamFromArray([])],
    (a, b) => a < b
  );
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, []);
  resolve();
});

test.asPromise('select: windowSize > 1 tolerates local disorder (drift)', async (t, resolve) => {
  // Stream 1 has timestamps {1, 3, 2} — locally disordered by 1 position.
  // windowSize=3 buffers all of it; the picker sees all candidates and emits in true order.
  const result = mergeSorted(
    [streamFromArray([1, 3, 2]), streamFromArray([4, 5])],
    (a, b) => a < b,
    {windowSize: 3}
  );
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2, 3, 4, 5]);
  resolve();
});

test.asPromise(
  'select: windowSize=1 with disordered stream produces locally-merged output',
  async (t, resolve) => {
    // Same disordered stream but windowSize=1 — picker sees one item per stream at a time,
    // so the disorder leaks through. This is the documented limitation of windowSize=1.
    const result = mergeSorted(
      [streamFromArray([1, 3, 2]), streamFromArray([4, 5])],
      (a, b) => a < b
    );
    const output = await streamToArrayOnce(result);
    // 1 < 4 → emit 1. Refill: stream 0 → 3. 3 < 4 → emit 3. Refill: stream 0 → 2.
    // 2 < 4 → emit 2. Refill: stream 0 → done. Then drain stream 1.
    t.deepEqual(output, [1, 3, 2, 4, 5]);
    resolve();
  }
);

test.asPromise('select: stop signal from pick ends the merge', async (t, resolve) => {
  let count = 0;
  const result = select([streamFromArray([1, 2, 3, 4, 5]), streamFromArray([10, 20, 30])], {
    pick: items => {
      if (count++ >= 3) return -1; // stop after 3 picks
      return pickMin((a, b) => a < b)(items);
    }
  });
  const output = await streamToArrayOnce(result);
  t.equal(output.length, 3);
  t.deepEqual(output, [1, 2, 3]);
  resolve();
});

test.asPromise('select: pick returning undefined ends the merge', async (t, resolve) => {
  let count = 0;
  const result = select([streamFromArray([1, 2, 3])], {
    pick: () => (count++ >= 2 ? undefined : 0)
  });
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2]);
  resolve();
});

test.asPromise('select: pick returning NaN ends the merge', async (t, resolve) => {
  let count = 0;
  const result = select([streamFromArray([1, 2, 3])], {
    pick: () => (count++ >= 1 ? NaN : 0)
  });
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1]);
  resolve();
});

test.asPromise('select: custom remove hook is invoked on stream end', async (t, resolve) => {
  const removed = [];
  const result = select([streamFromArray([1, 2]), streamFromArray([10])], {
    pick: pickMin((a, b) => a < b),
    remove(items, lastPos) {
      removed.push({lastPos, item: items[lastPos].item, index: items[lastPos].index});
      items.splice(lastPos, 1);
    }
  });
  await streamToArrayOnce(result);
  // pickMin picks 1, then 2 (both from stream 0), exhausting stream 0 first.
  // Then 10 from stream 1, exhausting stream 1.
  t.equal(removed.length, 2);
  t.equal(removed[0].index, 0);
  t.equal(removed[0].item, 2);
  t.equal(removed[1].index, 1);
  t.equal(removed[1].item, 10);
  resolve();
});

test.asPromise('select: items shrinks as streams exhaust', async (t, resolve) => {
  const sizes = [];
  const result = select(
    [streamFromArray([1, 4]), streamFromArray([2]), streamFromArray([3, 6, 9])],
    {
      pick: items => {
        sizes.push(items.length);
        return pickMin((a, b) => a < b)(items);
      }
    }
  );
  await streamToArrayOnce(result);
  // Initial fill: 3 items. After stream 1 (single value) exhausts: 2 items. After stream 0
  // exhausts: 1 item. After stream 2 exhausts: 0 (no pick call).
  t.deepEqual(sizes, [3, 3, 2, 2, 1, 1]);
  resolve();
});

test('select: throws on empty streams array', t => {
  t.throws(() => select([], {pick: pickFirst}), TypeError);
});

test('select: throws when pick is missing', t => {
  t.throws(() => select([streamFromArray([1])], {}), TypeError);
  t.throws(() => select([streamFromArray([1])]), TypeError);
});

test('select: throws on invalid windowSize', t => {
  t.throws(() => select([streamFromArray([1])], {pick: pickFirst, windowSize: 0}), TypeError);
  t.throws(() => select([streamFromArray([1])], {pick: pickFirst, windowSize: -1}), TypeError);
  t.throws(() => select([streamFromArray([1])], {pick: pickFirst, windowSize: 1.5}), TypeError);
});
