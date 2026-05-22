import test from 'tape-six';

import {Readable} from 'node:stream';
import type {TypedReadable} from 'stream-chain/typed-streams.js';

import join from '../../src/index.js';

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

test.asPromise('typings: tuple-typed items via explicit S generic', (t, resolve) => {
  const output: string[] = [];

  const s1 = Readable.from([1, 2, 3]) as unknown as TypedReadable<number>;
  const s2 = Readable.from(['a', 'b', 'c']) as unknown as TypedReadable<string>;

  // To recover positional `items` typing, the user supplies both generic args. TypeScript
  // cannot default `T` from `S` (no forward-reference in generic defaults), so the choice
  // is: explicit-both for tuple typing, or omit both for the unchanged flat-array default.
  type Streams = readonly [TypedReadable<number>, TypedReadable<string>];
  const result = join<string, Streams>([s1, s2], {
    joinItems(sink, items) {
      const a: number | null = items[0];
      const b: string | null = items[1];
      sink.push(`${a}-${b}`);
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
