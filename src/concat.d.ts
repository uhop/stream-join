/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from 'stream-chain/typed-streams.js';

/**
 * Concatenates N object-mode Readable streams into a single Readable, sequentially.
 * Stream 0 is fully drained, then stream 1, …, then stream N-1.
 *
 * Pullers are created lazily — one stream at a time — so streams that haven't started
 * yet don't buffer data in the meantime.
 *
 * The output's element type is the union of the input streams' value types.
 *
 * Throws `TypeError` if `streams` is missing, not an array, or empty.
 *
 * @typeParam S — the tuple type of input streams.
 * @param streams — non-empty array of object-mode Readable streams. Drained left-to-right.
 * @param options — optional. Standard `ReadableOptions` (the output Readable is forced to
 *   `objectMode: true` regardless of any value passed here).
 * @returns a `TypedReadable<ConcatItemType<S>>` that emits stream 0's values, then stream 1's,
 *   etc. Propagates `'error'` events from whichever input stream is currently being drained;
 *   ends when every input stream has ended.
 */
declare function concat<const S extends readonly Readable[] = readonly Readable[]>(
  streams: S,
  options?: concat.ConcatOptions
): TypedReadable<concat.ConcatItemType<S>>;

declare namespace concat {
  /**
   * Resolves to the value type of a `Readable` — `R` for `TypedReadable<R>`, otherwise `unknown`.
   *
   * @typeParam R — a `Readable` (or `TypedReadable<V>`) whose value type to extract.
   */
  export type StreamValue<R> = R extends TypedReadable<infer V> ? V : unknown;

  /**
   * Union of value types across the input streams.
   *
   * @typeParam S — the tuple type of input streams.
   */
  export type ConcatItemType<S extends readonly Readable[]> = StreamValue<S[number]>;

  /**
   * Options accepted by `concat()`. Extends `ReadableOptions`; `concat()` adds no options of its
   * own. The output Readable is always created with `objectMode: true`.
   */
  export interface ConcatOptions extends ReadableOptions {}
}

type StreamValue<R> = concat.StreamValue<R>;
type ConcatItemType<S extends readonly Readable[]> = concat.ConcatItemType<S>;
type ConcatOptions = concat.ConcatOptions;

export default concat;
export {concat};
export type {StreamValue, ConcatItemType, ConcatOptions};
