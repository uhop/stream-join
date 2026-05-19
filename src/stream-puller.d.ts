/// <reference types="node" />

import {Readable} from 'node:stream';

export = makeStreamPuller;

/**
 * Wraps a Readable as an awaitable item source.
 *
 * Internal utility; not intended for direct use by consumers. The contract
 * may change between minor releases of `stream-join`.
 */
declare function makeStreamPuller<T = unknown>(stream: Readable): makeStreamPuller.StreamPuller<T>;

declare namespace makeStreamPuller {
  /**
   * Result of a single `next()` call on a stream puller. Mirrors the
   * iterator-result protocol (`{value, done}`) but the puller is not an
   * iterator — it's a thin Promise-returning wrapper over event listeners.
   */
  export interface PullResult<T> {
    /** The next chunk from the stream, or `undefined` if `done` is true. */
    value: T | undefined;
    /** `true` once the source stream has ended. */
    done: boolean;
  }

  export interface StreamPuller<T> {
    /**
     * Resolves with the next chunk from the stream, or `{done: true}` once the
     * stream ends. Rejects with the original `'error'` value if the stream
     * errors (no AbortError wrapping). Rejects with a synthetic "Premature
     * stream close" error if the stream is destroyed without first emitting
     * `'end'` or `'error'`.
     */
    next(): Promise<PullResult<T>>;
    /**
     * Detaches all event listeners installed by the puller. Safe to call
     * multiple times; subsequent `next()` calls behave as if the underlying
     * stream is still in whatever state it was when `close` was called.
     */
    close(): void;
  }
}
