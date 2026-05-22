/**
 * Combines N `ReadableStream`s into a single `ReadableStream` by emitting values from
 * whichever input stream has data ready first.
 *
 * Different from `zip()` (waits for all N streams per round) and `select()` (awaits an
 * initial fill, then picks from a buffer): `race()` emits as soon as ANY stream has data,
 * without buffering across rounds.
 *
 * Output emission order is non-deterministic — depends on event-loop scheduling.
 *
 * Throws `TypeError` if `streams` is missing, not an array, or empty.
 *
 * @typeParam S — the tuple type of input streams.
 * @param streams — non-empty array of `ReadableStream`s.
 * @param options — optional. Currently no per-component options; reserved for future use.
 * @returns a `ReadableStream<RaceItemType<S>>` emitting values in arrival order.
 */
declare function race<
  const S extends readonly ReadableStream<unknown>[] = readonly ReadableStream<unknown>[]
>(streams: S, options?: race.RaceOptions): ReadableStream<race.RaceItemType<S>>;

declare namespace race {
  /**
   * Resolves to the value type of a `ReadableStream` — `R` for `ReadableStream<R>`, otherwise `unknown`.
   *
   * @typeParam R — a `ReadableStream<V>` whose value type to extract.
   */
  export type StreamValue<R> = R extends ReadableStream<infer V> ? V : unknown;

  /**
   * Union of value types across the input streams.
   *
   * @typeParam S — the tuple type of input streams.
   */
  export type RaceItemType<S extends readonly ReadableStream<unknown>[]> = StreamValue<S[number]>;

  /**
   * Options accepted by `race()` (Web variant). Currently no per-component options; reserved
   * for future use.
   */
  export interface RaceOptions {}
}

type StreamValue<R> = race.StreamValue<R>;
type RaceItemType<S extends readonly ReadableStream<unknown>[]> = race.RaceItemType<S>;
type RaceOptions = race.RaceOptions;

export default race;
export {race};
export type {StreamValue, RaceItemType, RaceOptions};
