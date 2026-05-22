import test from 'tape-six';

import {Readable} from 'node:stream';

import race from '../src/race.js';

import {streamFromArray, streamToArrayOnce} from './helpers.js';

// Helper: stream that emits one item per setTimeout tick, controlled per-item.
const tickStream = (items, delayMsPerItem) =>
  new Readable({
    objectMode: true,
    read() {
      if (isNaN(this.idx)) this.idx = 0;
      if (this.idx >= items.length) return this.push(null);
      const i = this.idx++;
      setTimeout(() => this.push(items[i]), delayMsPerItem);
    }
  });

test.asPromise('race: emits all values from all streams', async (t, resolve) => {
  // Two synchronous streams; race emits both streams' values exhaustively.
  const result = race([streamFromArray([1, 2, 3]), streamFromArray([10, 20, 30])]);
  const output = await streamToArrayOnce(result);
  const sorted = output.slice().sort((a, b) => a - b);
  t.deepEqual(sorted, [1, 2, 3, 10, 20, 30]);
  resolve();
});

test.asPromise('race: respects stream timing — faster stream emits first', async (t, resolve) => {
  // Stream A produces values every 1ms; stream B every 10ms. A should emit
  // most of its values before B emits its first.
  const result = race([tickStream(['a1', 'a2', 'a3'], 1), tickStream(['b1'], 50)]);
  const output = await streamToArrayOnce(result);
  // All four values appear:
  t.equal(output.length, 4);
  // a1, a2, a3 appear before b1:
  const b1Pos = output.indexOf('b1');
  t.equal(b1Pos, 3, 'b1 appears last because its stream is slower');
  resolve();
});

test.asPromise('race: single stream just passes values through', async (t, resolve) => {
  const result = race([streamFromArray([1, 2, 3])]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2, 3]);
  resolve();
});

test.asPromise('race: handles streams that end at different times', async (t, resolve) => {
  // Stream A: 3 items; Stream B: 1 item; Stream C: 2 items.
  const result = race([
    streamFromArray(['a1', 'a2', 'a3']),
    streamFromArray(['b1']),
    streamFromArray(['c1', 'c2'])
  ]);
  const output = await streamToArrayOnce(result);
  t.equal(output.length, 6);
  const counts = output.reduce((acc, v) => ((acc[v[0]] = (acc[v[0]] || 0) + 1), acc), {});
  t.deepEqual(counts, {a: 3, b: 1, c: 2});
  resolve();
});

test.asPromise('race: all empty streams produce empty output', async (t, resolve) => {
  const result = race([streamFromArray([]), streamFromArray([]), streamFromArray([])]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, []);
  resolve();
});

test.asPromise('race: input stream error propagates to output', (t, resolve) => {
  const boom = new Error('boom');
  const erroring = new Readable({
    objectMode: true,
    read() {
      setTimeout(() => this.emit('error', boom), 0);
    }
  });
  const result = race([streamFromArray([1, 2, 3]), erroring]);
  result.on('data', () => {});
  result.once('error', error => {
    t.equal(error, boom);
    resolve();
  });
});

test('race: throws on empty streams array', t => {
  t.throws(() => race([]), TypeError);
});
