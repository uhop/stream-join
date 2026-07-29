import test from 'tape-six';

import {Readable} from 'node:stream';

import race from '../../src/race.js';

import {streamFromArray, streamToArrayOnce} from '../helpers.js';

test.asPromise('race: emits all values from all streams', async (t, resolve) => {
  // Two synchronous streams; race emits both streams' values exhaustively.
  const result = race([streamFromArray([1, 2, 3]), streamFromArray([10, 20, 30])]);
  const output = await streamToArrayOnce(result);
  const sorted = output.slice().sort((a, b) => a - b);
  t.deepEqual(sorted, [1, 2, 3, 10, 20, 30]);
  resolve();
});

test.asPromise('race: respects stream readiness — pending stream emits last', (t, resolve) => {
  // Causality gate, not timers: b1 is produced only after race emitted a3,
  // so the order is deterministic (the 1ms-vs-50ms version flaked on CI 2026-07-28).
  let releaseB;
  const gate = new Promise(r => (releaseB = r));
  const b = new Readable({
    objectMode: true,
    read() {
      if (this.armed) return;
      this.armed = true;
      gate.then(() => {
        this.push('b1');
        this.push(null);
      });
    }
  });
  const result = race([streamFromArray(['a1', 'a2', 'a3']), b]);
  const output = [];
  result.on('data', value => {
    output.push(value);
    if (value === 'a3') releaseB();
  });
  result.on('end', () => {
    t.deepEqual(output, ['a1', 'a2', 'a3', 'b1']);
    resolve();
  });
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
