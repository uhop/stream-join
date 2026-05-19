// @ts-self-types="./stream-puller.d.ts"

'use strict';

// Internal: wraps a Readable as an awaitable item source.
// Backpressure via pause()/resume(). Original 'error' value preserved
// (no AbortError wrapping like Node's [Symbol.asyncIterator]()).
//
// Not part of the public API surface. Lives in `src/` only because the
// package's `exports` map uses a wildcard, not because callers should
// reach for it. The contract may change between minor releases.

const makeStreamPuller = stream => {
  const queue = []; // buffered chunks (when no waiter is parked)
  const waiters = []; // {resolve, reject} for pending next() calls
  let ended = false,
    errored = null;

  const onData = chunk => {
    if (waiters.length) waiters.shift().resolve({value: chunk, done: false});
    else {
      queue.push(chunk);
      stream.pause();
    }
  };
  const onEnd = () => {
    ended = true;
    while (waiters.length) waiters.shift().resolve({value: undefined, done: true});
  };
  const onError = err => {
    if (errored) return;
    errored = err;
    while (waiters.length) waiters.shift().reject(err);
  };
  const onClose = () => {
    // Premature close: stream destroyed without 'end' or 'error'.
    // Synthesize an error so pending waiters don't hang forever.
    if (ended || errored) return;
    const err = new Error('Premature stream close');
    errored = err;
    while (waiters.length) waiters.shift().reject(err);
  };

  stream.on('data', onData).on('end', onEnd).on('error', onError).on('close', onClose);

  const next = () =>
    new Promise((resolve, reject) => {
      if (errored) return reject(errored);
      if (queue.length) {
        resolve({value: queue.shift(), done: false});
        if (stream.isPaused() && queue.length === 0) stream.resume();
        return;
      }
      if (ended) return resolve({value: undefined, done: true});
      waiters.push({resolve, reject});
      if (stream.isPaused()) stream.resume();
    });

  const close = () =>
    stream.off('data', onData).off('end', onEnd).off('error', onError).off('close', onClose);

  return {next, close};
};

module.exports = makeStreamPuller;
