import test from 'tape-six';

import {Readable} from 'node:stream';

import select from '../src/select.js';
import pickFirst from '../src/utils/pick-first.js';
import {streamFromArray} from './helpers.js';

const erroringStream = (error, delay = 0) =>
  new Readable({
    objectMode: true,
    read() {
      setTimeout(() => this.emit('error', error), delay);
    }
  });

test.asPromise('select errors: input-stream error reaches the output', (t, resolve) => {
  const boom = new Error('boom');
  const result = select([streamFromArray([1, 2, 3]), erroringStream(boom)], {pick: pickFirst});
  result.on('data', () => {});
  result.once('error', error => {
    t.equal(error, boom);
    resolve();
  });
});

test.asPromise('select errors: error from first position reaches the output', (t, resolve) => {
  const boom = new Error('boom');
  const result = select([erroringStream(boom), streamFromArray([1, 2, 3])], {pick: pickFirst});
  result.on('data', () => {});
  result.once('error', error => {
    t.equal(error, boom);
    resolve();
  });
});

test.asPromise('select errors: error mid-stream after some emissions propagates', (t, resolve) => {
  const boom = new Error('boom');
  let count = 0;
  const erroring = new Readable({
    objectMode: true,
    read() {
      if (count < 2) {
        this.push(count++);
      } else {
        setTimeout(() => this.emit('error', boom), 0);
      }
    }
  });
  const result = select([erroring], {pick: pickFirst});
  result.on('data', () => {});
  result.once('error', error => {
    t.equal(error, boom);
    resolve();
  });
});

test.asPromise(
  'select errors: error during initial fill (windowSize > 1) propagates',
  (t, resolve) => {
    const boom = new Error('boom');
    let count = 0;
    // Stream emits one value then errors on the next read. With windowSize=3, the
    // initial fill awaits three pulls per stream — the error happens inside the
    // Promise.all that drives the initial fill.
    const erroring = new Readable({
      objectMode: true,
      read() {
        if (count === 0) {
          this.push(count++);
        } else {
          setTimeout(() => this.emit('error', boom), 0);
        }
      }
    });
    const result = select([erroring], {pick: pickFirst, windowSize: 3});
    result.on('data', () => {});
    result.once('error', error => {
      t.equal(error, boom);
      resolve();
    });
  }
);
