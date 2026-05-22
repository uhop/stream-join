import test from 'tape-six';

import zip from '../src/web/index.js';
import select from '../src/web/select.js';
import race from '../src/web/race.js';
import concat from '../src/web/concat.js';
import pickFirst from '../src/utils/pick-first.js';
import pickMin from '../src/utils/pick-min.js';

const webStreamFrom = array => {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < array.length) controller.enqueue(array[i++]);
      else controller.close();
    }
  });
};

const collect = async stream => {
  const out = [];
  const reader = stream.getReader();
  for (;;) {
    const {value, done} = await reader.read();
    if (done) return out;
    out.push(value);
  }
};

test.asPromise('web/zip: default joinItems pairs values per round', async (t, resolve) => {
  const result = zip([webStreamFrom([1, 2, 3]), webStreamFrom(['a', 'b', 'c'])]);
  t.deepEqual(await collect(result), [
    [1, 'a'],
    [2, 'b'],
    [3, 'c']
  ]);
  resolve();
});

test.asPromise('web/zip: shorter stream contributes null after exhaustion', async (t, resolve) => {
  const result = zip([webStreamFrom([1, 2, 3, 4]), webStreamFrom(['a', 'b'])]);
  t.deepEqual(await collect(result), [
    [1, 'a'],
    [2, 'b'],
    [3, null],
    [4, null]
  ]);
  resolve();
});

test.asPromise('web/zip: custom joinItems reshapes values', async (t, resolve) => {
  const result = zip([webStreamFrom([1, 2, 3]), webStreamFrom(['a', 'b', 'c'])], {
    joinItems(sink, items) {
      sink.push(`${items[0]}-${items[1]}`);
    }
  });
  t.deepEqual(await collect(result), ['1-a', '2-b', '3-c']);
  resolve();
});

test('web/zip: throws on empty input', t => {
  t.throws(() => zip([]), TypeError);
  t.throws(() => zip(), TypeError);
});

test.asPromise(
  'web/select: pickFirst exhausts streams in order (default insert)',
  async (t, resolve) => {
    const result = select([webStreamFrom([1, 2, 3]), webStreamFrom([10, 20, 30])], {
      pick: pickFirst
    });
    t.deepEqual(await collect(result), [1, 2, 3, 10, 20, 30]);
    resolve();
  }
);

test.asPromise(
  'web/select: pickMin + default insert gives priority-queue merge',
  async (t, resolve) => {
    const result = select(
      [webStreamFrom([1, 4, 7]), webStreamFrom([2, 5, 8]), webStreamFrom([3, 6, 9])],
      {pick: pickMin((a, b) => a < b)}
    );
    t.deepEqual(await collect(result), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    resolve();
  }
);

test('web/select: throws on missing pick', t => {
  t.throws(() => select([webStreamFrom([1])], {}), TypeError);
  t.throws(() => select([webStreamFrom([1])]), TypeError);
});

test.asPromise('web/race: emits all values from all streams', async (t, resolve) => {
  const result = race([webStreamFrom([1, 2, 3]), webStreamFrom([10, 20]), webStreamFrom([100])]);
  const got = await collect(result);
  t.deepEqual(
    got.sort((a, b) => a - b),
    [1, 2, 3, 10, 20, 100]
  );
  resolve();
});

test('web/race: throws on empty input', t => {
  t.throws(() => race([]), TypeError);
  t.throws(() => race(), TypeError);
});

test.asPromise('web/concat: drains streams left-to-right', async (t, resolve) => {
  const result = concat([
    webStreamFrom([1, 2]),
    webStreamFrom(['a', 'b']),
    webStreamFrom([true, false])
  ]);
  t.deepEqual(await collect(result), [1, 2, 'a', 'b', true, false]);
  resolve();
});

test('web/concat: throws on empty input', t => {
  t.throws(() => concat([]), TypeError);
  t.throws(() => concat(), TypeError);
});
