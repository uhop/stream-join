import test from 'tape-six';

import concat from '../../src/web/concat.js';
import {webStreamFromArray, collectWebStream, erroringWebStream} from '../web-helpers.js';

test.asPromise('concat: drains streams in input order', async (t, resolve) => {
  const result = concat([
    webStreamFromArray([1, 2, 3]),
    webStreamFromArray([10, 20, 30]),
    webStreamFromArray([100, 200])
  ]);
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 3, 10, 20, 30, 100, 200]);
  resolve();
});

test.asPromise('concat: empty streams in the middle are skipped over', async (t, resolve) => {
  const result = concat([
    webStreamFromArray([1, 2]),
    webStreamFromArray([]),
    webStreamFromArray([3, 4])
  ]);
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 3, 4]);
  resolve();
});

test.asPromise('concat: all empty streams produce empty output', async (t, resolve) => {
  const result = concat([webStreamFromArray([]), webStreamFromArray([]), webStreamFromArray([])]);
  const output = await collectWebStream(result);
  t.deepEqual(output, []);
  resolve();
});

test.asPromise('concat: single stream just passes values through', async (t, resolve) => {
  const result = concat([webStreamFromArray(['a', 'b', 'c'])]);
  const output = await collectWebStream(result);
  t.deepEqual(output, ['a', 'b', 'c']);
  resolve();
});

test.asPromise('concat: heterogeneous value types', async (t, resolve) => {
  const result = concat([
    webStreamFromArray([1, 2]),
    webStreamFromArray(['a', 'b']),
    webStreamFromArray([{x: 1}])
  ]);
  const output = await collectWebStream(result);
  t.deepEqual(output, [1, 2, 'a', 'b', {x: 1}]);
  resolve();
});

test.asPromise('concat: error in any stream propagates to output', async (t, resolve) => {
  const boom = new Error('boom');
  const result = concat([
    webStreamFromArray([1, 2, 3]),
    erroringWebStream(boom),
    webStreamFromArray([100])
  ]);
  try {
    await collectWebStream(result);
    t.fail('expected error');
  } catch (error) {
    t.equal(error, boom);
  }
  resolve();
});

test.asPromise(
  'concat: error in the last stream propagates after earlier emissions',
  async (t, resolve) => {
    const boom = new Error('boom');
    const result = concat([
      webStreamFromArray([1, 2]),
      webStreamFromArray([3, 4]),
      erroringWebStream(boom)
    ]);
    const seen = [];
    const reader = result.getReader();
    try {
      for (;;) {
        const {value, done} = await reader.read();
        if (done) break;
        seen.push(value);
      }
      t.fail('expected error');
    } catch (error) {
      t.equal(error, boom);
      t.deepEqual(seen, [1, 2, 3, 4]);
    }
    resolve();
  }
);

test.asPromise(
  'concat: lazy puller — later streams not activated until earlier exhausts',
  async (t, resolve) => {
    // Per the D14 design decision, pullers are created lazily so streams that
    // haven't started yet don't pre-buffer. Each tracking stream records when
    // its `pull` was first called; concat must activate them strictly in input
    // order.
    const activations = [];
    const trackingStream = (label, items) => {
      let started = false;
      let i = 0;
      return new ReadableStream({
        pull(controller) {
          if (!started) {
            activations.push(label);
            started = true;
          }
          if (i < items.length) controller.enqueue(items[i++]);
          else controller.close();
        }
      });
    };
    const s1 = trackingStream('s1', [1, 2, 3]);
    const s2 = trackingStream('s2', [10, 20]);
    const s3 = trackingStream('s3', [100]);

    const result = concat([s1, s2, s3]);
    const output = await collectWebStream(result);
    t.deepEqual(output, [1, 2, 3, 10, 20, 100]);
    t.deepEqual(activations, ['s1', 's2', 's3']);
    resolve();
  }
);

test('concat: throws on empty streams array', t => {
  t.throws(() => concat([]), TypeError);
});
