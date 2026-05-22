import test from 'tape-six';

import join from '../../src/index.js';
import {streamFromArray, PassThrough, streamToArrayOnce} from '../helpers.js';

test.asPromise('simple: 3 streams, default joinItems', async (t, resolve) => {
  const result = join([
    streamFromArray([1, 2, 3]),
    streamFromArray(['a', 'b', 'c']),
    streamFromArray(['A', 'B', 'C'])
  ]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [
    [1, 'a', 'A'],
    [2, 'b', 'B'],
    [3, 'c', 'C']
  ]);
  resolve();
});

test.asPromise('simple: 2 streams, sequential writes', async (t, resolve) => {
  const s1 = new PassThrough(),
    s2 = new PassThrough(),
    result = join([s1, s2]),
    consumed = streamToArrayOnce(result);

  s2.write('a');
  s2.write('b');
  s2.write('c');
  s2.end();
  s1.write(1);
  s1.write(2);
  s1.write(3);
  s1.end();

  t.deepEqual(await consumed, [
    [1, 'a'],
    [2, 'b'],
    [3, 'c']
  ]);
  resolve();
});

test.asPromise('simple: 2 streams, interleaved writes', async (t, resolve) => {
  const s1 = new PassThrough(),
    s2 = new PassThrough(),
    result = join([s1, s2]),
    consumed = streamToArrayOnce(result);

  s2.write('a');
  s1.write(1);
  s1.write(2);
  s2.write('b');
  s2.write('c');
  s2.end();
  s1.write(3);
  s1.end();

  t.deepEqual(await consumed, [
    [1, 'a'],
    [2, 'b'],
    [3, 'c']
  ]);
  resolve();
});

test.asPromise('simple: 2 streams, first outlasts second', async (t, resolve) => {
  const s1 = new PassThrough(),
    s2 = new PassThrough(),
    result = join([s1, s2]),
    consumed = streamToArrayOnce(result);

  s2.write('a');
  s1.write(1);
  s1.write(2);
  s2.write('b');
  s1.write(3);
  s2.end();
  s1.write(4);
  s1.end();

  t.deepEqual(await consumed, [
    [1, 'a'],
    [2, 'b'],
    [3, null],
    [4, null]
  ]);
  resolve();
});

test.asPromise('simple: 2 streams, second outlasts first', async (t, resolve) => {
  const s1 = new PassThrough(),
    s2 = new PassThrough(),
    result = join([s1, s2]),
    consumed = streamToArrayOnce(result);

  s2.write('a');
  s1.write(1);
  s2.write('b');
  s1.write(2);
  s2.write('c');
  s2.write('d');
  s2.end();
  s1.end();

  t.deepEqual(await consumed, [
    [1, 'a'],
    [2, 'b'],
    [null, 'c'],
    [null, 'd']
  ]);
  resolve();
});

test.asPromise('simple: single-stream join is a passthrough', async (t, resolve) => {
  const result = join([streamFromArray([1, 2, 3])]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, [[1], [2], [3]]);
  resolve();
});

test.asPromise('simple: all empty streams', async (t, resolve) => {
  const result = join([streamFromArray([]), streamFromArray([]), streamFromArray([])]);
  const output = await streamToArrayOnce(result);
  t.deepEqual(output, []);
  resolve();
});

test('simple: throws on empty streams array', t => {
  t.throws(() => join([]), TypeError);
  t.throws(() => join(), TypeError);
});
