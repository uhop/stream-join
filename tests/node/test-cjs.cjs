'use strict';

const {test} = require('tape-six');

const {Readable} = require('node:stream');

const {zip, select, race, concat} = require('../../src/index.js');

const readableFrom = array => Readable.from(array, {objectMode: true});

const collect = stream =>
  new Promise((resolve, reject) => {
    const out = [];
    stream.on('data', value => out.push(value));
    stream.on('end', () => resolve(out));
    stream.on('error', reject);
  });

test.asPromise('cjs: require zip — default per-round tuples', async (t, resolve) => {
  const result = zip([readableFrom([1, 2, 3]), readableFrom(['a', 'b', 'c'])]);
  t.deepEqual(await collect(result), [
    [1, 'a'],
    [2, 'b'],
    [3, 'c']
  ]);
  resolve();
});

test.asPromise('cjs: require zip — custom joinItems reshapes each round', async (t, resolve) => {
  const result = zip([readableFrom([1, 2, 3]), readableFrom(['a', 'b', 'c'])], {
    joinItems(sink, items) {
      sink.push(items.join('-'));
    }
  });
  t.deepEqual(await collect(result), ['1-a', '2-b', '3-c']);
  resolve();
});

test.asPromise('cjs: require select — pickMin priority-queue merge', async (t, resolve) => {
  const {pickMin} = require('../../src/utils/pick-min.js');

  const result = select(
    [readableFrom([1, 4, 7]), readableFrom([2, 5, 8]), readableFrom([3, 6, 9])],
    {pick: pickMin((a, b) => a < b)}
  );
  t.deepEqual(await collect(result), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  resolve();
});

test.asPromise(
  'cjs: require select — pickFirst + sortedInsert merges sorted streams',
  async (t, resolve) => {
    const {pickFirst} = require('../../src/utils/pick-first.js');
    const {sortedInsert} = require('../../src/utils/sorted-insert.js');

    const result = select([readableFrom([1, 4, 7]), readableFrom([2, 5, 8])], {
      pick: pickFirst,
      insert: sortedInsert((a, b) => a < b)
    });
    t.deepEqual(await collect(result), [1, 2, 4, 5, 7, 8]);
    resolve();
  }
);

test.asPromise('cjs: require concat — drains streams in input order', async (t, resolve) => {
  const result = concat([readableFrom([1, 2]), readableFrom([3, 4]), readableFrom([5])]);
  t.deepEqual(await collect(result), [1, 2, 3, 4, 5]);
  resolve();
});

test.asPromise('cjs: require race — emits every value from all streams', async (t, resolve) => {
  const result = race([readableFrom([1, 2, 3]), readableFrom([10, 20, 30])]);
  const output = await collect(result);
  t.deepEqual(
    output.slice().sort((a, b) => a - b),
    [1, 2, 3, 10, 20, 30]
  );
  resolve();
});

test.asPromise('cjs: require mergeSorted via subpath', async (t, resolve) => {
  const {mergeSorted} = require('../../src/utils/merge-sorted.js');

  const result = mergeSorted(
    [readableFrom([1, 4, 7]), readableFrom([2, 5, 8]), readableFrom([3, 6, 9])],
    (a, b) => a < b
  );
  t.deepEqual(await collect(result), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  resolve();
});

test('cjs: subpath require exposes default with a named mirror', t => {
  const zipMod = require('../../src/zip.js');
  const selectMod = require('../../src/select.js');
  const raceMod = require('../../src/race.js');
  const concatMod = require('../../src/concat.js');

  t.equal(typeof zipMod.zip, 'function');
  t.equal(zipMod.zip, zipMod.default); // named export mirrors the default
  t.equal(selectMod.select, selectMod.default);
  t.equal(raceMod.race, raceMod.default);
  t.equal(concatMod.concat, concatMod.default);
});
