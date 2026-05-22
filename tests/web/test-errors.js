import test from 'tape-six';

import zip from '../../src/web/index.js';
import {webStreamFromArray, collectWebStream, erroringWebStream} from '../web-helpers.js';

test.asPromise('errors: input-stream error reaches the output', async (t, resolve) => {
  const boom = new Error('boom');
  const result = zip([webStreamFromArray([1, 2, 3]), erroringWebStream(boom)]);
  try {
    await collectWebStream(result);
    t.fail('expected error');
  } catch (error) {
    t.equal(error, boom);
  }
  resolve();
});

test.asPromise('errors: error from any position reaches the output', async (t, resolve) => {
  const boom = new Error('boom');
  const result = zip([erroringWebStream(boom), webStreamFromArray([1, 2, 3])]);
  try {
    await collectWebStream(result);
    t.fail('expected error');
  } catch (error) {
    t.equal(error, boom);
  }
  resolve();
});

test.asPromise(
  'errors: legacy skipEvents option is accepted (no-op in 2.x)',
  async (t, resolve) => {
    const boom = new Error('boom');
    const result = zip([webStreamFromArray([1, 2, 3]), erroringWebStream(boom)], {
      skipEvents: true
    });
    try {
      await collectWebStream(result);
      t.fail('expected error');
    } catch (error) {
      t.equal(error, boom);
    }
    resolve();
  }
);

test.asPromise('errors: joinItems sync throw propagates to the output', async (t, resolve) => {
  const boom = new Error('boom');
  const result = zip([webStreamFromArray([1, 2, 3]), webStreamFromArray(['a', 'b', 'c'])], {
    joinItems() {
      throw boom;
    }
  });
  try {
    await collectWebStream(result);
    t.fail('expected error');
  } catch (error) {
    t.equal(error, boom);
  }
  resolve();
});

test.asPromise('errors: joinItems async rejection propagates to the output', async (t, resolve) => {
  const boom = new Error('boom');
  const result = zip([webStreamFromArray([1, 2, 3]), webStreamFromArray(['a', 'b', 'c'])], {
    async joinItems() {
      throw boom;
    }
  });
  try {
    await collectWebStream(result);
    t.fail('expected error');
  } catch (error) {
    t.equal(error, boom);
  }
  resolve();
});
