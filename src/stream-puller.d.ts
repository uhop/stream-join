/// <reference types="node" />

import {Readable} from 'node:stream';

export = makeStreamPuller;

/**
 * Wraps a Readable as an awaitable item source. Backpressure is handled via the
 * underlying stream's `pause()` / `resume()`; original `'error'` values are
 * preserved (no AbortError wrapping like Node's `Readable[Symbol.asyncIterator]()`).
 *
 * Internal utility; not intended for direct use by consumers. The contract may
 * change between minor releases of `stream-join`.
 *
 * @typeParam T — the value type of the underlying stream's items. Defaults to `unknown`.
 * @param stream — the Readable to wrap. Event listeners are attached immediately;
 *   call `puller.close()` to detach them.
 * @returns a `StreamPuller<T>` exposing `next()` and `close()`.
 */
declare function makeStreamPuller<T = unknown>(stream: Readable): makeStreamPuller.StreamPuller<T>;

declare namespace makeStreamPuller {
  /**
   * Result of a single `next()` call on a stream puller. Mirrors the iterator-result protocol
   * (`{value, done}`) but the puller is not an iterator — it's a thin Promise-returning wrapper
   * over event listeners.
   *
   * @typeParam T — the value type carried by the puller.
   */
  export interface PullResult<T> {
    /** The next chunk from the stream, or `undefined` if `done` is `true`. */
    value: T | undefined;
    /** `true` once the source stream has ended; `false` while values are still flowing. */
    done: boolean;
  }

  /**
   * Awaitable handle over a Readable. Use `next()` to pull one item at a time and `close()`
   * to detach the puller's listeners when done.
   *
   * @typeParam T — the value type of the underlying stream's items.
   */
  export interface StreamPuller<T> {
    /**
     * Pull the next chunk from the stream.
     *
     * @returns a `Promise<PullResult<T>>` that resolves with the next chunk or
     *   `{value: undefined, done: true}` once the stream ends. Rejects with the original
     *   `'error'` value if the stream errors (no AbortError wrapping). Rejects with a
     *   synthetic `Error('Premature stream close')` if the stream is destroyed without
     *   first emitting `'end'` or `'error'`.
     */
    next(): Promise<PullResult<T>>;

    /**
     * Detach all event listeners installed by the puller on the underlying stream.
     * Safe to call multiple times; subsequent `next()` calls behave as if the underlying
     * stream is still in whatever state it was when `close` was called.
     *
     * @returns nothing.
     */
    close(): void;
  }
}
