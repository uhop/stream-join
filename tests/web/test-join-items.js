import test from 'tape-six';

import zip from '../../src/web/index.js';
import {webStreamFromArray, collectWebStream} from '../web-helpers.js';

test.asPromise('joinItems: 3-stream concat with separator', async (t, resolve) => {
  const result = zip(
    [
      webStreamFromArray([1, 2, 3]),
      webStreamFromArray(['a', 'b', 'c']),
      webStreamFromArray(['A', 'B', 'C'])
    ],
    {
      joinItems(sink, items) {
        sink.push(items.join('-'));
      }
    }
  );
  const output = await collectWebStream(result);
  t.deepEqual(output, ['1-a-A', '2-b-B', '3-c-C']);
  resolve();
});

test.asPromise('joinItems: push non-null items individually', async (t, resolve) => {
  const result = zip([webStreamFromArray([1, 2, 3]), webStreamFromArray(['a', 'b'])], {
    joinItems(sink, items) {
      if (items[0] !== null) sink.push(items[0]);
      if (items[1] !== null) sink.push(items[1]);
    }
  });
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 'a', 2, 'b', 3]);
  resolve();
});

test.asPromise('joinItems: callback may push zero values', async (t, resolve) => {
  const result = zip([webStreamFromArray([1, 2, 3, 4]), webStreamFromArray([10, 20, 30, 40])], {
    joinItems(sink, items) {
      if (items[0] !== null && items[0] % 2 === 0) {
        sink.push(items[0] + items[1]);
      }
    }
  });
  const output = await collectWebStream(result);
  t.deepEqual(output, [22, 44]);
  resolve();
});

test.asPromise('joinItems: callback may push many values', async (t, resolve) => {
  const result = zip([webStreamFromArray([1, 2]), webStreamFromArray(['a', 'b'])], {
    joinItems(sink, items) {
      sink.push(items[0]);
      sink.push(items[1]);
      sink.push([items[0], items[1]]);
    }
  });
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 'a', [1, 'a'], 2, 'b', [2, 'b']]);
  resolve();
});

test.asPromise('joinItems: receives null markers for ended streams', async (t, resolve) => {
  const seenItems = [];
  const result = zip([webStreamFromArray([1, 2, 3]), webStreamFromArray(['a'])], {
    joinItems(sink, items) {
      seenItems.push([...items]);
      sink.push(items);
    }
  });
  await collectWebStream(result);
  t.deepEqual(seenItems, [
    [1, 'a'],
    [2, null],
    [3, null]
  ]);
  resolve();
});

test.asPromise('joinItems: async callback is awaited per round', async (t, resolve) => {
  let order = '';
  const result = zip([webStreamFromArray([1, 2, 3]), webStreamFromArray(['a', 'b', 'c'])], {
    async joinItems(sink, items) {
      order += '<';
      await Promise.resolve();
      order += '>';
      sink.push(items.join('-'));
    }
  });
  const output = await collectWebStream(result);
  t.deepEqual(output, ['1-a', '2-b', '3-c']);
  t.equal(order, '<><><>');
  resolve();
});
