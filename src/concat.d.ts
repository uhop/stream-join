/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from 'stream-chain/typed-streams.js';

export = concat;

/**
 * Concatenates N object-mode Readable streams into a single Readable, sequentially.
 * Stream 0 is fully drained, then stream 1, …, then stream N-1.
 *
 * Pullers are created lazily — one stream at a time — so streams that haven't started
 * yet don't buffer data in the meantime.
 *
 * The output's element type is the union of the input streams' value types.
 *
 * @param streams non-empty array of object-mode Readable streams
 * @param options optional ReadableOptions passed through to the output Readable
 */
declare function concat<const S extends readonly Readable[] = readonly Readable[]>(
  streams: S,
  options?: concat.ConcatOptions
): TypedReadable<concat.ConcatItemType<S>>;

declare namespace concat {
  /**
   * Resolves to the value type of a `Readable` — `R` for `TypedReadable<R>`, otherwise `unknown`.
   */
  export type StreamValue<R> = R extends TypedReadable<infer V> ? V : unknown;

  /**
   * Union of value types across the input streams.
   */
  export type ConcatItemType<S extends readonly Readable[]> = StreamValue<S[number]>;

  export interface ConcatOptions extends ReadableOptions {}
}
