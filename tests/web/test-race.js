import test from 'tape-six';

import race from '../../src/web/race.js';
import {webStreamFromArray, collectWebStream, erroringWebStream} from '../web-helpers.js';

test.asPromise('race: emits all values from all streams', async (t, resolve) => {
  const result = race([webStreamFromArray([1, 2, 3]), webStreamFromArray([10, 20, 30])]);
  const output = await collectWebStream(result);
  const sorted = output.slice().sort((a, b) => a - b);
  t.deepEqual(sorted, [1, 2, 3, 10, 20, 30]);
  resolve();
});

test.asPromise(
  'race: respects stream readiness — pending stream emits last',
  async (t, resolve) => {
    // Causality gate, not timers — see the Node twin in tests/node/test-race.js.
    let releaseB;
    const gate = new Promise(r => (releaseB = r));
    const b = new ReadableStream({
      async pull(controller) {
        await gate;
        controller.enqueue('b1');
        controller.close();
      }
    });
    const result = race([webStreamFromArray(['a1', 'a2', 'a3']), b]);
    const output = [];
    const reader = result.getReader();
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      output.push(value);
      if (value === 'a3') releaseB();
    }
    t.deepEqual(output, ['a1', 'a2', 'a3', 'b1']);
    resolve();
  }
);

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
