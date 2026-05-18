'use strict';

import test from 'tape-six';

import {Readable} from 'node:stream';

import join from '../src/index.js';
import {streamFromArray} from './helpers.mjs';

const erroringStream = (error, delay = 0) =>
  new Readable({
    objectMode: true,
    read() {
      setTimeout(() => this.emit('error', error), delay);
    }
  });

test.asPromise('errors: input-stream error reaches the output', (t, resolve) => {
  const boom = new Error('boom');
  const result = join([streamFromArray([1, 2, 3]), erroringStream(boom)]);
  result.on('data', () => {});
  result.once('error', error => {
    t.equal(error, boom);
    resolve();
  });
});

test.asPromise('errors: error from any position reaches the output', (t, resolve) => {
  const boom = new Error('boom');
  const result = join([erroringStream(boom), streamFromArray([1, 2, 3])]);
  result.on('data', () => {});
  result.once('error', error => {
    t.equal(error, boom);
    resolve();
  });
});

test.asPromise('errors: legacy skipEvents option is accepted (no-op in 2.x)', (t, resolve) => {
  const boom = new Error('boom');
  const result = join([streamFromArray([1, 2, 3]), erroringStream(boom)], {skipEvents: true});
  result.on('data', () => {});
  result.once('error', error => {
    t.equal(error, boom);
    resolve();
  });
});
