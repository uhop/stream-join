'use strict';

import test from 'tape-six';

import {Readable} from 'node:stream';

import concat from '../src/concat.js';

import {streamFromArray, streamToArrayOnce} from './helpers.mjs';

test.asPromise('concat: drains streams in input order', async (t, resolve) => {
  const result = concat([
    streamFromArray([1, 2, 3]),
    streamFromArray([10, 20, 30]),
    streamFromArray([100, 200])
  ]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2, 3, 10, 20, 30, 100, 200]);
  resolve();
});

test.asPromise('concat: empty streams in the middle are skipped over', async (t, resolve) => {
  const result = concat([streamFromArray([1, 2]), streamFromArray([]), streamFromArray([3, 4])]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2, 3, 4]);
  resolve();
});

test.asPromise('concat: all empty streams produce empty output', async (t, resolve) => {
  const result = concat([streamFromArray([]), streamFromArray([]), streamFromArray([])]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, []);
  resolve();
});

test.asPromise('concat: single stream just passes values through', async (t, resolve) => {
  const result = concat([streamFromArray(['a', 'b', 'c'])]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, ['a', 'b', 'c']);
  resolve();
});

test.asPromise('concat: heterogeneous value types', async (t, resolve) => {
  const result = concat([
    streamFromArray([1, 2]),
    streamFromArray(['a', 'b']),
    streamFromArray([{x: 1}])
  ]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [1, 2, 'a', 'b', {x: 1}]);
  resolve();
});

test.asPromise('concat: error in any stream propagates to output', (t, resolve) => {
  const boom = new Error('boom');
  const erroring = new Readable({
    objectMode: true,
    read() {
      setTimeout(() => this.emit('error', boom), 0);
    }
  });
  const result = concat([streamFromArray([1, 2, 3]), erroring, streamFromArray([100])]);
  result.on('data', () => {});
  result.once('error', error => {
    t.equal(error, boom);
    resolve();
  });
});

test.asPromise(
  'concat: error in the last stream propagates after earlier emissions',
  (t, resolve) => {
    const boom = new Error('boom');
    const erroring = new Readable({
      objectMode: true,
      read() {
        setTimeout(() => this.emit('error', boom), 0);
      }
    });
    const seen = [];
    const result = concat([streamFromArray([1, 2]), streamFromArray([3, 4]), erroring]);
    result.on('data', v => seen.push(v));
    result.once('error', error => {
      t.equal(error, boom);
      t.deepEqual(seen, [1, 2, 3, 4]);
      resolve();
    });
  }
);

test.asPromise(
  'concat: lazy puller — later streams not activated until earlier exhausts',
  async (t, resolve) => {
    // Per the D14 design decision, pullers are created lazily one stream at a time so
    // streams that haven't started yet don't pre-buffer. Each stream records when its
    // `_read` is first called; concat must activate them strictly in input order.
    const activations = [];
    const trackingStream = (label, items) => {
      let started = false;
      let index = 0;
      return new Readable({
        objectMode: true,
        read() {
          if (!started) {
            activations.push(label);
            started = true;
          }
          if (index < items.length) {
            this.push(items[index++]);
          } else {
            this.push(null);
          }
        }
      });
    };
    const s1 = trackingStream('s1', [1, 2, 3]);
    const s2 = trackingStream('s2', [10, 20]);
    const s3 = trackingStream('s3', [100]);

    const result = concat([s1, s2, s3]);
    const output = await streamToArrayOnce(result);
    t.deepEqual(output, [1, 2, 3, 10, 20, 100]);
    t.deepEqual(activations, ['s1', 's2', 's3']);
    resolve();
  }
);

test('concat: throws on empty streams array', t => {
  t.throws(() => concat([]), TypeError);
});
