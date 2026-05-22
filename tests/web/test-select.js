import test from 'tape-six';

import select from '../../src/web/select.js';
import mergeSorted from '../../src/web/utils/merge-sorted.js';
import pickFirst from '../../src/utils/pick-first.js';
import pickMin from '../../src/utils/pick-min.js';
import sortedInsert from '../../src/utils/sorted-insert.js';

import {webStreamFromArray, collectWebStream} from '../web-helpers.js';

test.asPromise(
  'select: smoke — pickFirst with default insert exhausts streams in order',
  async (t, resolve) => {
    const result = select([webStreamFromArray([1, 2, 3]), webStreamFromArray([10, 20, 30])], {
      pick: pickFirst
    });
    const output = await collectWebStream(result);
    t.deepEqual(output, [1, 2, 3, 10, 20, 30]);
    resolve();
  }
);

test.asPromise(
  'select: pickMin + default insert gives priority-queue merge',
  async (t, resolve) => {
    const result = select(
      [webStreamFromArray([1, 4, 7]), webStreamFromArray([2, 5, 8]), webStreamFromArray([3, 6, 9])],
      {pick: pickMin((a, b) => a < b)}
    );
    const output = await collectWebStream(result);
    t.deepEqual(output, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    resolve();
  }
);

test.asPromise('select: pickFirst + sortedInsert merges sorted streams', async (t, resolve) => {
  const less = (a, b) => a < b;
  const result = select(
    [
      webStreamFromArray([1, 4, 7, 10]),
      webStreamFromArray([2, 5, 8]),
      webStreamFromArray([3, 6, 9, 12, 15])
    ],
    {pick: pickFirst, insert: sortedInsert(less)}
  );
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15]);
  resolve();
});

test.asPromise('select: mergeSorted umbrella helper', async (t, resolve) => {
  const result = mergeSorted(
    [webStreamFromArray([1, 4, 7]), webStreamFromArray([2, 5, 8]), webStreamFromArray([3, 6, 9])],
    (a, b) => a < b
  );
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  resolve();
});

test.asPromise('select: mergeSorted with mismatched stream lengths', async (t, resolve) => {
  const result = mergeSorted(
    [webStreamFromArray([1, 10, 100]), webStreamFromArray([2]), webStreamFromArray([3, 30])],
    (a, b) => a < b
  );
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 3, 10, 30, 100]);
  resolve();
});

test.asPromise('select: mergeSorted with one empty stream', async (t, resolve) => {
  const result = mergeSorted(
    [webStreamFromArray([1, 4, 7]), webStreamFromArray([]), webStreamFromArray([2, 5, 8])],
    (a, b) => a < b
  );
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 4, 5, 7, 8]);
  resolve();
});

test.asPromise('select: mergeSorted with all empty streams', async (t, resolve) => {
  const result = mergeSorted(
    [webStreamFromArray([]), webStreamFromArray([]), webStreamFromArray([])],
    (a, b) => a < b
  );
  const output = await collectWebStream(result);
  t.deepEqual(output, []);
  resolve();
});

test.asPromise('select: windowSize > 1 tolerates local disorder (drift)', async (t, resolve) => {
  const result = mergeSorted(
    [webStreamFromArray([1, 3, 2]), webStreamFromArray([4, 5])],
    (a, b) => a < b,
    {windowSize: 3}
  );
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 3, 4, 5]);
  resolve();
});

test.asPromise(
  'select: windowSize=1 with disordered stream produces locally-merged output',
  async (t, resolve) => {
    const result = mergeSorted(
      [webStreamFromArray([1, 3, 2]), webStreamFromArray([4, 5])],
      (a, b) => a < b
    );
    const output = await collectWebStream(result);
    t.deepEqual(output, [1, 3, 2, 4, 5]);
    resolve();
  }
);

test.asPromise('select: stop signal from pick ends the merge', async (t, resolve) => {
  let count = 0;
  const result = select([webStreamFromArray([1, 2, 3, 4, 5]), webStreamFromArray([10, 20, 30])], {
    pick: items => {
      if (count++ >= 3) return -1;
      return pickMin((a, b) => a < b)(items);
    }
  });
  const output = await collectWebStream(result);
  t.equal(output.length, 3);
  t.deepEqual(output, [1, 2, 3]);
  resolve();
});

test.asPromise('select: pick returning undefined ends the merge', async (t, resolve) => {
  let count = 0;
  const result = select([webStreamFromArray([1, 2, 3])], {
    pick: () => (count++ >= 2 ? undefined : 0)
  });
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2]);
  resolve();
});

test.asPromise('select: pick returning NaN ends the merge', async (t, resolve) => {
  let count = 0;
  const result = select([webStreamFromArray([1, 2, 3])], {
    pick: () => (count++ >= 1 ? NaN : 0)
  });
  const output = await collectWebStream(result);
  t.deepEqual(output, [1]);
  resolve();
});

test.asPromise('select: pick returning Infinity ends the merge', async (t, resolve) => {
  let count = 0;
  const result = select([webStreamFromArray([1, 2, 3])], {
    pick: () => (count++ >= 1 ? Infinity : 0)
  });
  const output = await collectWebStream(result);
  t.deepEqual(output, [1]);
  resolve();
});

test.asPromise(
  'select: pick returning items.length (overflow) ends the merge',
  async (t, resolve) => {
    let count = 0;
    const result = select([webStreamFromArray([1, 2, 3])], {
      pick: items => (count++ >= 1 ? items.length : 0)
    });
    const output = await collectWebStream(result);
    t.deepEqual(output, [1]);
    resolve();
  }
);

test.asPromise('select: pick returning a non-integer ends the merge', async (t, resolve) => {
  let count = 0;
  const result = select([webStreamFromArray([1, 2, 3]), webStreamFromArray([10, 20])], {
    pick: () => (count++ >= 1 ? 1.5 : 0)
  });
  const output = await collectWebStream(result);
  t.deepEqual(output, [1]);
  resolve();
});

test.asPromise(
  'select: custom insert hook is invoked on initial fill and refill',
  async (t, resolve) => {
    const inserts = [];
    const result = select([webStreamFromArray([1, 2]), webStreamFromArray([10])], {
      pick: pickMin((a, b) => a < b),
      insert(items, newSlot, lastPos) {
        inserts.push({lastPos, item: newSlot.item, index: newSlot.index});
        if (lastPos === undefined) items.push(newSlot);
        else items[lastPos] = newSlot;
      }
    });
    await collectWebStream(result);
    t.equal(inserts.length, 3);
    const initial = inserts.filter(x => x.lastPos === undefined);
    const refills = inserts.filter(x => x.lastPos !== undefined);
    t.equal(initial.length, 2);
    t.equal(refills.length, 1);
    t.equal(refills[0].item, 2);
    t.equal(refills[0].index, 0);
    resolve();
  }
);

test.asPromise('select: windowSize larger than stream length still drains', async (t, resolve) => {
  const result = select([webStreamFromArray([1, 2]), webStreamFromArray([10, 20])], {
    pick: pickMin((a, b) => a < b),
    windowSize: 5
  });
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 10, 20]);
  resolve();
});

test.asPromise('select: custom remove hook is invoked on stream end', async (t, resolve) => {
  const removed = [];
  const result = select([webStreamFromArray([1, 2]), webStreamFromArray([10])], {
    pick: pickMin((a, b) => a < b),
    remove(items, lastPos) {
      removed.push({lastPos, item: items[lastPos].item, index: items[lastPos].index});
      items.splice(lastPos, 1);
    }
  });
  await collectWebStream(result);
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
    [webStreamFromArray([1, 4]), webStreamFromArray([2]), webStreamFromArray([3, 6, 9])],
    {
      pick: items => {
        sizes.push(items.length);
        return pickMin((a, b) => a < b)(items);
      }
    }
  );
  await collectWebStream(result);
  t.deepEqual(sizes, [3, 3, 2, 2, 1, 1]);
  resolve();
});

test('select: throws on empty streams array', t => {
  t.throws(() => select([], {pick: pickFirst}), TypeError);
});

test('select: throws when pick is missing', t => {
  t.throws(() => select([webStreamFromArray([1])], {}), TypeError);
  t.throws(() => select([webStreamFromArray([1])]), TypeError);
});

test('select: throws on invalid windowSize', t => {
  t.throws(() => select([webStreamFromArray([1])], {pick: pickFirst, windowSize: 0}), TypeError);
  t.throws(() => select([webStreamFromArray([1])], {pick: pickFirst, windowSize: -1}), TypeError);
  t.throws(() => select([webStreamFromArray([1])], {pick: pickFirst, windowSize: 1.5}), TypeError);
});
