/// <reference types="node" />

import {Readable, ReadableOptions} from 'node:stream';
import {TypedReadable} from 'stream-chain/typed-streams.js';

export = race;

/**
 * Combines N object-mode Readable streams into a single Readable by emitting values
 * from whichever input stream has data ready first.
 *
 * Different from `zip()` (waits for all N streams per round) and `select()` (awaits an
 * initial fill, then picks from a buffer): `race()` emits as soon as ANY stream has data,
 * without buffering across rounds. Natural fit for merging live event streams where the
 * output shouldn't be bounded by the slowest source.
 *
 * Output emission order is non-deterministic — it depends on how the input streams' data
 * events interleave in the event loop. The output's element type is the union of the
 * input streams' value types.
 *
 * @param streams non-empty array of object-mode Readable streams
 * @param options optional ReadableOptions passed through to the output Readable
 */
declare function race<const S extends readonly Readable[] = readonly Readable[]>(
  streams: S,
  options?: race.RaceOptions
): TypedReadable<race.RaceItemType<S>>;

declare namespace race {
  /**
   * Resolves to the value type of a `Readable` — `R` for `TypedReadable<R>`, otherwise `unknown`.
   */
  export type StreamValue<R> = R extends TypedReadable<infer V> ? V : unknown;

  /**
   * Union of value types across the input streams.
   */
  export type RaceItemType<S extends readonly Readable[]> = StreamValue<S[number]>;

  export interface RaceOptions extends ReadableOptions {}
}
