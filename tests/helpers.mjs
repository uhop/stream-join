'use strict';

import {Readable, Writable, Transform} from 'node:stream';

export const streamFromArray = array =>
  new Readable({
    objectMode: true,
    read() {
      if (isNaN(this.index)) this.index = 0;
      this.push(this.index < array.length ? array[this.index++] : null);
    }
  });

export const streamToArray = array =>
  new Writable({
    objectMode: true,
    write(chunk, _, callback) {
      array.push(chunk);
      callback(null);
    }
  });

export class PassThrough extends Transform {
  constructor(options) {
    super({...options, writableObjectMode: true, readableObjectMode: true});
  }
  _transform(chunk, _, callback) {
    this.push(chunk);
    callback(null);
  }
}

export const streamToArrayOnce = stream =>
  new Promise((resolve, reject) => {
    const output = [];
    stream.on('data', value => output.push(value));
    stream.on('end', () => resolve(output));
    stream.on('error', reject);
  });
