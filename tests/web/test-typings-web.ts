import test from 'tape-six';

import zip, {select, race, concat} from '../../src/web/index.js';
import type {JoinOptions, JoinSink} from '../../src/web/zip.js';
import type {SelectOptions} from '../../src/web/select.js';
import type {RaceOptions} from '../../src/web/race.js';
import type {ConcatOptions} from '../../src/web/concat.js';

import pickFirst from '../../src/utils/pick-first.js';
import sortedInsert from '../../src/utils/sorted-insert.js';

const webReadableFrom = <T>(array: T[]): ReadableStream<T> =>
  new ReadableStream<T>({
    start(controller) {
      for (const value of array) controller.enqueue(value);
      controller.close();
    }
  });

const collect = async <T>(stream: ReadableStream<T>): Promise<T[]> => {
  const out: T[] = [];
  const reader = stream.getReader();
  for (;;) {
    const {value, done} = await reader.read();
    if (done) return out;
    out.push(value);
  }
};

test.asPromise('typings zip (web): default tuple output', async (t, resolve) => {
  const options: JoinOptions = {};
  const result: ReadableStream<readonly (unknown | null)[]> = zip(
    [webReadableFrom([1, 2, 3]), webReadableFrom(['a', 'b', 'c'])],
    options
  );

  t.deepEqual(await collect(result), [
    [1, 'a'],
    [2, 'b'],
    [3, 'c']
  ]);
  resolve();
});

test.asPromise('typings zip (web): custom joinItems reshapes to T', async (t, resolve) => {
  const result = zip<string>([webReadableFrom([1, 2, 3]), webReadableFrom(['a', 'b', 'c'])], {
    joinItems(sink: JoinSink<string>, items) {
      sink.push(items.join('-'));
    }
  });

  t.deepEqual(await collect(result), ['1-a', '2-b', '3-c']);
  resolve();
});

test.asPromise(
  'typings select (web): sorted merge over an explicit stream tuple',
  async (t, resolve) => {
    const s1 = webReadableFrom([1, 4, 7]);
    const s2 = webReadableFrom([2, 5, 8]);
    type Streams = readonly [ReadableStream<number>, ReadableStream<number>];

    // `pick: pickFirst` + `insert: sortedInsert` is the K-way merge primitive; the explicit
    // `Streams` tuple recovers `Slot<number>` typing on both hooks (same pattern as the Node
    // typings test's tuple case).
    const less = (a: number, b: number): boolean => a < b;
    const options: SelectOptions<Streams> = {pick: pickFirst, insert: sortedInsert(less)};
    const result: ReadableStream<number> = select<Streams>([s1, s2], options);

    t.deepEqual(await collect(result), [1, 2, 4, 5, 7, 8]);
    resolve();
  }
);

test.asPromise(
  'typings race (web): emits every value; options surface typed',
  async (t, resolve) => {
    const options: RaceOptions = {};
    const result = race([webReadableFrom([1, 2, 3]), webReadableFrom([10, 20, 30])], options);

    const output = await collect(result);
    t.deepEqual(
      output.slice().sort((a, b) => a - b),
      [1, 2, 3, 10, 20, 30]
    );
    resolve();
  }
);

test.asPromise(
  'typings concat (web): sequential drain; options surface typed',
  async (t, resolve) => {
    const options: ConcatOptions = {};
    const result = concat([webReadableFrom([1, 2]), webReadableFrom([3, 4])], options);

    t.deepEqual(await collect(result), [1, 2, 3, 4]);
    resolve();
  }
);

test('typings (web): ESM default and named exports resolve', t => {
  // Compile-time regression guard for the `.d.ts` ESM default-export trap: `declare function`
  // must precede `declare namespace`, or `import zip from './zip.js'` fails with "has no default
  // export". This body never runs — it only has to type-check across all four components.
  const check = (): void => {
    const z: ReadableStream<readonly (unknown | null)[]> = zip([webReadableFrom([1])]);
    void z;
    const selectOpts: SelectOptions = {pick: () => 0};
    void select([webReadableFrom([1])], selectOpts);
    void race([webReadableFrom([1])]);
    void concat([webReadableFrom([1])]);
  };
  void check;
  t.pass();
});
