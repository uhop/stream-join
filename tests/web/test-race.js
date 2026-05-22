import test from 'tape-six';

import race from '../../src/web/race.js';
import {webStreamFromArray, collectWebStream, erroringWebStream} from '../web-helpers.js';

// Web ReadableStream that emits one item per setTimeout tick.
const tickWebStream = (items, delayMsPerItem) => {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= items.length) {
        controller.close();
        return;
      }
      const j = i++;
      return new Promise(resolve => {
        setTimeout(() => {
          controller.enqueue(items[j]);
          resolve();
        }, delayMsPerItem);
      });
    }
  });
};

test.asPromise('race: emits all values from all streams', async (t, resolve) => {
  const result = race([webStreamFromArray([1, 2, 3]), webStreamFromArray([10, 20, 30])]);
  const output = await collectWebStream(result);
  const sorted = output.slice().sort((a, b) => a - b);
  t.deepEqual(sorted, [1, 2, 3, 10, 20, 30]);
  resolve();
});

test.asPromise('race: respects stream timing — faster stream emits first', async (t, resolve) => {
  const result = race([tickWebStream(['a1', 'a2', 'a3'], 1), tickWebStream(['b1'], 50)]);
  const output = await collectWebStream(result);
  t.equal(output.length, 4);
  const b1Pos = output.indexOf('b1');
  t.equal(b1Pos, 3, 'b1 appears last because its stream is slower');
  resolve();
});

test.asPromise('race: single stream just passes values through', async (t, resolve) => {
  const result = race([webStreamFromArray([1, 2, 3])]);
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 3]);
  resolve();
});

test.asPromise('race: handles streams that end at different times', async (t, resolve) => {
  const result = race([
    webStreamFromArray(['a1', 'a2', 'a3']),
    webStreamFromArray(['b1']),
    webStreamFromArray(['c1', 'c2'])
  ]);
  const output = await collectWebStream(result);
  t.equal(output.length, 6);
  const counts = output.reduce((acc, v) => ((acc[v[0]] = (acc[v[0]] || 0) + 1), acc), {});
  t.deepEqual(counts, {a: 3, b: 1, c: 2});
  resolve();
});

test.asPromise('race: all empty streams produce empty output', async (t, resolve) => {
  const result = race([webStreamFromArray([]), webStreamFromArray([]), webStreamFromArray([])]);
  const output = await collectWebStream(result);
  t.deepEqual(output, []);
  resolve();
});

test.asPromise('race: input stream error propagates to output', async (t, resolve) => {
  const boom = new Error('boom');
  const result = race([webStreamFromArray([1, 2, 3]), erroringWebStream(boom)]);
  try {
    await collectWebStream(result);
    t.fail('expected error');
  } catch (error) {
    t.equal(error, boom);
  }
  resolve();
});

test('race: throws on empty streams array', t => {
  t.throws(() => race([]), TypeError);
});
