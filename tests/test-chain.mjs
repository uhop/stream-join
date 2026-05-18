'use strict';

import test from 'tape-six';

import chain from 'stream-chain';

import join from '../src/index.js';
import {streamFromArray, streamToArrayOnce} from './helpers.mjs';

test.asPromise('chain: join output feeds a chain pipeline', async (t, resolve) => {
  const pipeline = chain([
    join([streamFromArray([1, 2, 3]), streamFromArray([10, 20, 30])]),
    ([a, b]) => a + b,
    x => x * 2
  ]);
  const output = await streamToArrayOnce(pipeline);
  t.deepEqual(output, [22, 44, 66]);
  resolve();
});

test.asPromise('chain: join with custom joinItems inside a chain', async (t, resolve) => {
  const pipeline = chain([
    join([streamFromArray(['a', 'b', 'c']), streamFromArray(['x', 'y', 'z'])], {
      joinItems(sink, items) {
        sink.push(items[0]);
        sink.push(items[1]);
      }
    }),
    s => s.toUpperCase()
  ]);
  const output = await streamToArrayOnce(pipeline);
  t.deepEqual(output, ['A', 'X', 'B', 'Y', 'C', 'Z']);
  resolve();
});
