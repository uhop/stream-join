// Internal: pure generator factory shape consumed by `src/select.js` (Node)
// and `src/web/select.js` (Web). The public types (`Slot`, `SelectOptions`)
// live on `../select.js` / `../web/select.js`.

/**
 * Slot shape in the buffer the picker / inserter / remover sees.
 *
 * @typeParam T — value type carried by this slot.
 */
export interface SelectSlot<T = unknown> {
  /** Value pulled from the source stream. */
  item: T;
  /** Position of the source stream in the input array. */
  index: number;
}

/**
 * Options accepted by `selectGen`.
 *
 * @typeParam T — slot item type.
 */
export interface SelectGenOptions<T = unknown> {
  /**
   * Required. Given the current buffer of slots, returns the index of the
   * slot to emit and refill. Any non-integer / out-of-range return value
   * stops the merge.
   */
  pick: (items: readonly SelectSlot<T>[]) => number;
  /**
   * Optional. Places a freshly-pulled slot into `items` (mutates in place).
   * Default: replace at `lastPos` (or `push` when `lastPos` is undefined).
   */
  insert?: (items: SelectSlot<T>[], newSlot: SelectSlot<T>, lastPos?: number) => void;
  /**
   * Optional. Called when the source stream of `items[lastPos]` has
   * exhausted; the hook MUST decrease `items.length` by 1.
   * Default: `items.splice(lastPos, 1)`.
   */
  remove?: (items: SelectSlot<T>[], lastPos: number) => void;
  /**
   * Optional. Per-stream buffer depth. Default `1`. Must be a positive
   * integer.
   */
  windowSize?: number;
}

/**
 * Pure async-generator factory for `select`. Returns a 0-arg generator
 * function; calling it once produces the async iterator the runtime wrapper
 * hands to `readableFrom` / `ReadableStream.from`.
 *
 * @typeParam T — slot item type.
 * @param pullers — non-empty array of async iterators. Validation is the
 *   wrapper's responsibility; `selectGen` trusts its inputs.
 * @param options — must include `pick`; may include `insert`, `remove`,
 *   `windowSize`.
 * @returns a 0-arg async-generator function.
 */
declare function selectGen<T = unknown>(
  pullers: readonly AsyncIterator<T>[],
  options: SelectGenOptions<T>
): () => AsyncGenerator<T, void, unknown>;

export default selectGen;
export {selectGen};
