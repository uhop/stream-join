'use strict';

const {test} = require('tape-six');

const {Readable, Writable} = require('node:stream');

const join = require('../src/index.js');

const fromArray = array =>
  new Readable({
    objectMode: true,
    read() {
      if (isNaN(this.index)) this.index = 0;
      this.push(this.index < array.length ? array[this.index++] : null);
    }
  });

const toArray = array =>
  new Writable({
    objectMode: true,
    write(chunk, _, callback) {
      array.push(chunk);
      callback(null);
    }
  });

test.asPromise('cjs: require stream-join', (t, resolve) => {
  const output = [];
  join([fromArray([1, 2, 3]), fromArray(['a', 'b', 'c'])])
    .pipe(toArray(output))
    .on('finish', () => {
      t.deepEqual(output, [
        [1, 'a'],
        [2, 'b'],
        [3, 'c']
      ]);
      resolve();
    });
});
