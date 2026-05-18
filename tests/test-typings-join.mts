import test from 'tape-six';

import {Readable} from 'node:stream';

import join from '../src/index.js';

test.asPromise(
  'typings: default join — items typed as readonly (unknown | null)[]',
  (t, resolve) => {
    const output: ReadonlyArray<unknown | null>[] = [];
    const result = join([Readable.from([1, 2, 3]), Readable.from(['a', 'b', 'c'])]);

    result.on('data', (chunk: ReadonlyArray<unknown | null>) => output.push(chunk));
    result.on('end', () => {
      t.deepEqual(output, [
        [1, 'a'],
        [2, 'b'],
        [3, 'c']
      ]);
      resolve();
    });
  }
);

test.asPromise('typings: custom joinItems — sink and items typed', (t, resolve) => {
  const output: string[] = [];
  const result = join<string>([Readable.from([1, 2, 3]), Readable.from(['a', 'b', 'c'])], {
    joinItems(sink, items) {
      sink.push(items.join('-'));
    }
  });

  result.on('data', (chunk: string) => output.push(chunk));
  result.on('end', () => {
    t.deepEqual(output, ['1-a', '2-b', '3-c']);
    resolve();
  });
});

test.asPromise('typings: legacy skipEvents option is typed (no-op)', (t, resolve) => {
  const output: ReadonlyArray<unknown | null>[] = [];
  const result = join([Readable.from([1, 2]), Readable.from(['a', 'b'])], {skipEvents: true});

  result.on('data', (chunk: ReadonlyArray<unknown | null>) => output.push(chunk));
  result.on('end', () => {
    t.deepEqual(output, [
      [1, 'a'],
      [2, 'b']
    ]);
    resolve();
  });
});
