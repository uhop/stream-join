import test from 'tape-six';

import zip from '../../src/web/index.js';
import {webStreamFromArray, collectWebStream, webPassThrough} from '../web-helpers.js';

test.asPromise('simple: 3 streams, default joinItems', async (t, resolve) => {
  const result = zip([
    webStreamFromArray([1, 2, 3]),
    webStreamFromArray(['a', 'b', 'c']),
    webStreamFromArray(['A', 'B', 'C'])
  ]);
  const output = await collectWebStream(result);
  t.deepEqual(output, [
    [1, 'a', 'A'],
    [2, 'b', 'B'],
    [3, 'c', 'C']
  ]);
  resolve();
});

test.asPromise('simple: 2 streams, sequential writes', async (t, resolve) => {
  const s1 = webPassThrough();
  const s2 = webPassThrough();
  const result = zip([s1.readable, s2.readable]);
  const consumed = collectWebStream(result);

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
  const s1 = webPassThrough();
  const s2 = webPassThrough();
  const result = zip([s1.readable, s2.readable]);
  const consumed = collectWebStream(result);

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
  const s1 = webPassThrough();
  const s2 = webPassThrough();
  const result = zip([s1.readable, s2.readable]);
  const consumed = collectWebStream(result);

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
  const s1 = webPassThrough();
  const s2 = webPassThrough();
  const result = zip([s1.readable, s2.readable]);
  const consumed = collectWebStream(result);

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

test.asPromise('simple: single-stream zip is a passthrough', async (t, resolve) => {
  const result = zip([webStreamFromArray([1, 2, 3])]);
  const output = await collectWebStream(result);
  t.deepEqual(output, [[1], [2], [3]]);
  resolve();
});

test.asPromise('simple: all empty streams', async (t, resolve) => {
  const result = zip([webStreamFromArray([]), webStreamFromArray([]), webStreamFromArray([])]);
  const output = await collectWebStream(result);
  t.deepEqual(output, []);
  resolve();
});

test('simple: throws on empty streams array', t => {
  t.throws(() => zip([]), TypeError);
  t.throws(() => zip(), TypeError);
});
