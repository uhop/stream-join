import test from 'tape-six';

import select from '../../src/web/select.js';
import pickFirst from '../../src/utils/pick-first.js';
import {webStreamFromArray, collectWebStream, erroringWebStream} from '../web-helpers.js';

test.asPromise('select errors: input-stream error reaches the output', async (t, resolve) => {
  const boom = new Error('boom');
  const result = select([webStreamFromArray([1, 2, 3]), erroringWebStream(boom)], {
    pick: pickFirst
  });
  try {
    await collectWebStream(result);
    t.fail('expected error');
  } catch (error) {
    t.equal(error, boom);
  }
  resolve();
});

test.asPromise(
  'select errors: error from first position reaches the output',
  async (t, resolve) => {
    const boom = new Error('boom');
    const result = select([erroringWebStream(boom), webStreamFromArray([1, 2, 3])], {
      pick: pickFirst
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

test.asPromise(
  'select errors: error mid-stream after some emissions propagates',
  async (t, resolve) => {
    const boom = new Error('boom');
    let count = 0;
    const erroring = new ReadableStream({
      pull(controller) {
        if (count < 2) {
          controller.enqueue(count++);
        } else {
          controller.error(boom);
        }
      }
    });
    const result = select([erroring], {pick: pickFirst});
    try {
      await collectWebStream(result);
      t.fail('expected error');
    } catch (error) {
      t.equal(error, boom);
    }
    resolve();
  }
);

test.asPromise(
  'select errors: error during initial fill (windowSize > 1) propagates',
  async (t, resolve) => {
    const boom = new Error('boom');
    let count = 0;
    const erroring = new ReadableStream({
      pull(controller) {
        if (count === 0) {
          controller.enqueue(count++);
        } else {
          controller.error(boom);
        }
      }
    });
    const result = select([erroring], {pick: pickFirst, windowSize: 3});
    try {
      await collectWebStream(result);
      t.fail('expected error');
    } catch (error) {
      t.equal(error, boom);
    }
    resolve();
  }
);
