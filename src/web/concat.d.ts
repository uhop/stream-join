/**
 * Concatenates N `ReadableStream`s into a single `ReadableStream`, sequentially. Stream 0
 * is fully drained, then stream 1, …, then stream N-1.
 *
 * Pullers are created lazily — one stream at a time — so streams that haven't started yet
 * don't buffer data in the meantime.
 *
 * Throws `TypeError` if `streams` is missing, not an array, or empty.
 *
 * @typeParam S — the tuple type of input streams.
 * @param streams — non-empty array of `ReadableStream`s. Drained left-to-right.
 * @param options — optional. Currently no per-component options; reserved for future use.
 * @returns a `ReadableStream<ConcatItemType<S>>` that emits stream 0's values, then stream 1's, etc.
 */
declare function concat<
  const S extends readonly ReadableStream<unknown>[] = readonly ReadableStream<unknown>[]
>(streams: S, options?: concat.ConcatOptions): ReadableStream<concat.ConcatItemType<S>>;

declare namespace concat {
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
  export type ConcatItemType<S extends readonly ReadableStream<unknown>[]> = StreamValue<S[number]>;

  /**
   * Options accepted by `concat()` (Web variant). Currently no per-component options; reserved
   * for future use.
   */
  export interface ConcatOptions {}
}

type StreamValue<R> = concat.StreamValue<R>;
type ConcatItemType<S extends readonly ReadableStream<unknown>[]> = concat.ConcatItemType<S>;
type ConcatOptions = concat.ConcatOptions;

export default concat;
export {concat};
export type {StreamValue, ConcatItemType, ConcatOptions};
