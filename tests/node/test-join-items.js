import test from 'tape-six';

import join from '../../src/index.js';
import {streamFromArray, streamToArrayOnce} from '../helpers.js';

test.asPromise('joinItems: 3-stream concat with separator', async (t, resolve) => {
  const result = join(
    [
      streamFromArray([1, 2, 3]),
      streamFromArray(['a', 'b', 'c']),
      streamFromArray(['A', 'B', 'C'])
    ],
    {
      joinItems(sink, items) {
        sink.push(items.join('-'));
      }
    }
  );
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, ['1-a-A', '2-b-B', '3-c-C']);
  resolve();
});

test.asPromise('joinItems: push non-null items individually', async (t, resolve) => {
  const result = join([streamFromArray([1, 2, 3]), streamFromArray(['a', 'b'])], {
    joinItems(sink, items) {
      if (items[0] !== null) sink.push(items[0]);
      if (items[1] !== null) sink.push(items[1]);
    }
  });
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 'a', 2, 'b', 3]);
  resolve();
});

test.asPromise('joinItems: callback may push zero values', async (t, resolve) => {
  const result = join([streamFromArray([1, 2, 3, 4]), streamFromArray([10, 20, 30, 40])], {
    joinItems(sink, items) {
      if (items[0] !== null && items[0] % 2 === 0) {
        sink.push(items[0] + items[1]);
      }
    }
  });
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [22, 44]);
  resolve();
});

test.asPromise('joinItems: callback may push many values', async (t, resolve) => {
  const result = join([streamFromArray([1, 2]), streamFromArray(['a', 'b'])], {
    joinItems(sink, items) {
      sink.push(items[0]);
      sink.push(items[1]);
      sink.push([items[0], items[1]]);
    }
  });
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 'a', [1, 'a'], 2, 'b', [2, 'b']]);
  resolve();
});

test.asPromise('joinItems: receives null markers for ended streams', async (t, resolve) => {
  const seenItems = [];
  const result = join([streamFromArray([1, 2, 3]), streamFromArray(['a'])], {
    joinItems(sink, items) {
      seenItems.push([...items]);
      sink.push(items);
    }
  });
  await streamToArrayOnce(result);
  t.deepEqual(seenItems, [
    [1, 'a'],
    [2, null],
    [3, null]
  ]);
  resolve();
});

test.asPromise('joinItems: async callback is awaited per round', async (t, resolve) => {
  let order = '';
  const result = join([streamFromArray([1, 2, 3]), streamFromArray(['a', 'b', 'c'])], {
    async joinItems(sink, items) {
      order += '<';
      await Promise.resolve();
      order += '>';
      sink.push(items.join('-'));
    }
  });
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, ['1-a', '2-b', '3-c']);
  // `<>` interleaving (never `<<>>` or similar) confirms each round's async work
  // completed before the next round started.
  t.equal(order, '<><><>');
  resolve();
});
