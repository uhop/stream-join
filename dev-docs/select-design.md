# `select()` — design note

A second N→1 primitive for `stream-join`, alongside the existing `zip()` (currently the default export `join()`). This note captures the design choices behind it. Status: pre-implementation; everything here is subject to revision as the implementation surfaces issues.

## What it is

`zip()` advances all N streams in lockstep — every round pulls one item from each, the user's callback combines the N values into 0+ outputs. Output cardinality is bounded by the shortest input stream's length.

`select()` advances **one** stream per round. Every round, the user picks one of the currently-buffered items; that item is emitted; its source stream is read for a replacement; the new item is placed back into the buffer (in a spot the user controls). The output continues until every input stream has been exhausted and every buffered item picked.

Same `N→1` family as `zip()`, but the control flow is asymmetric (one advance per emit, not N). Different mental model, different file. They share infrastructure (the per-stream puller, see below) but not the operation.

## Use cases

- **K-way merge of sorted streams.** Pick = min-by-comparator, insert = sorted-insert. Output is fully sorted if every input is sorted.
- **Merge phase of external merge sort.** The merge phase of disk-backed external sort IS this operation with a min-by-key picker. Building `select()` here means `stream-sorting` can use it directly rather than re-implementing.
- **Merge-join over sorted streams.** Pick by min-key, combine with downstream `chain()` step → key-based SQL-style join in pure Node streams.
- **Priority-queue style merge.** User picks by application-defined priority, not necessarily min-of-a-comparator.
- **Drift-tolerant merge.** With `windowSize > 1`, the buffer holds multiple items per stream; the picker sees up to `N × windowSize` candidates and can recover true global ordering even when individual streams have local jitter (timestamps slightly out of order, etc.).

## Public API sketch

```js
const select = require('stream-join/select');

const result = select(streams, {
  // Required: pick one of the currently-buffered slots to emit.
  // items is a read-only array of {item, index} slots, length up to N*windowSize.
  // Returns an index in [0, items.length). Any other return value
  // (undefined, null, NaN, negative, >= items.length) stops the merge.
  pick(items) {
    return 0; // example: always pick the first slot (sorted-merge with sortedInsert)
  },

  // Optional: insert a freshly-pulled slot into items.
  // Mutates items in place. lastPos is the index `pick` returned for the
  // slot that was just emitted; undefined during initial fill.
  // Default: replace in place at lastPos (or push when lastPos is undefined).
  insert(items, newSlot, lastPos) {
    if (lastPos === undefined) items.push(newSlot);
    else items[lastPos] = newSlot;
  },

  // Optional: remove a slot whose source stream has exhausted.
  // Mutates items in place. Default: items.splice(lastPos, 1).
  remove(items, lastPos) {
    items.splice(lastPos, 1);
  },

  // Optional: per-stream buffer depth. Default 1. Must be >= 1.
  windowSize: 1
});
```

Helpers shipped alongside:

```js
const sortedInsert = require('stream-join/sorted-insert');
const pickFirst = require('stream-join/pick-first');

const lessByTime = (a, b) => a.timestamp < b.timestamp;

select(streams, {
  pick: pickFirst,
  insert: sortedInsert(lessByTime),
  windowSize: 4 // tolerate up to ~4 items of local disorder per stream
});
```

`pickFirst` is the right partner for `sortedInsert`: the array is always sorted, so the slot to emit is always at index 0. Pairing `pickMin` (a linear scan) with `sortedInsert` would defeat the point of sorted-insert — the scan rediscovers what sort already knows. Use `pickMin` only when the array is **not** maintained in sorted order (priority-queue style with the default replace-in-place insert, for example).

## Slot shape

Every entry in `items` is a `{item, index}` object:

- `item` — the value pulled from the source stream.
- `index` — the position of the source stream in the input `streams` array.

That's the minimum the system needs: `item` for the picker's decision, `index` to know which stream to refill after a pick. No ordinal `n`, no parallel provenance array — `pick()` returns an index into `items`, so the system uses `items[returnedIndex].index` to identify the source stream. O(1), no lookups, no referential-integrity concerns.

`items` and its slots are **read-only by contract.** Documented in the readme; not enforced via `Object.freeze` (perf cost in hot loops isn't worth catching this class of user error). If a caller wants to transform values before they reach downstream, they do it as a `chain()` step on the output, not by mutating slots inside `pick`/`insert`/`remove`.

## `pick`: the picker

Signature: `(items: readonly Slot[]) => number`

Returns the index in `items` of the slot to emit. The system then:

1. Emits `items[returnedIndex].item` downstream.
2. Pulls a new item from the puller for `streams[items[returnedIndex].index]`.
3. If the stream is **not** exhausted: calls `insert(items, {item: newItem, index}, lastPos: returnedIndex)` to place the new slot. The user's `insert` MUST keep `items.length` unchanged in this branch (replace-in-place is the default).
4. If the stream **is** exhausted: calls `remove(items, lastPos: returnedIndex)`. The user's `remove` MUST decrease `items.length` by 1 (the default `items.splice(lastPos, 1)` does so).
5. When `items.length === 0`, emits `end`.

**Stop signals.** If `pick` returns any of the following, the system emits `end` immediately, regardless of remaining buffered items or unread stream content:

- `undefined`, `null`
- a number not in `[0, items.length)` — including negative, NaN, `+Infinity`, etc.

A single range check at the call site covers all of these. The user gets early termination ("I've seen enough") for free, and accidental bad returns fail closed (end the stream) rather than crash.

## `insert`: the replacement placer

Signature: `(items: Slot[], newSlot: Slot, lastPos?: number) => void`

Mutates `items` in place. Called in two contexts with two contracts:

- **Initial fill** (`lastPos === undefined`). The user's hook MAY grow `items` by 1 — typically a `push` (default) or a sorted splice (`sortedInsert`). Up to `N × windowSize` calls during the initial fill phase (less if some streams finish early).
- **Post-pick refill** (`lastPos` defined). The user's hook MUST keep `items.length` unchanged. Replace-in-place at `lastPos` is the default; `sortedInsert` splices out at `lastPos` and splices in at the new sorted position (net length: zero). Document the invariant; don't enforce (perf), but it's a correctness contract.

Default behavior:

```js
const defaultInsert = (items, newSlot, lastPos) => {
  if (lastPos === undefined) items.push(newSlot);
  else items[lastPos] = newSlot;
};
```

## `remove`: the stream-end handler

Signature: `(items: Slot[], lastPos: number) => void`

Called when `pick` returned `lastPos` AND the source stream's puller reports `{done: true}`. The user's hook MUST decrease `items.length` by 1 (the slot at `lastPos` is gone for good — no replacement is coming).

Default behavior:

```js
const defaultRemove = (items, lastPos) => items.splice(lastPos, 1);
```

Two reasons to expose this as a hook rather than always splicing:

- **Symmetry.** With `{pick, insert, remove}` all present, the slot lifecycle is complete and explicit. A reader of the API sees the full surface without wondering where stream-end handling lives.
- **External invariants.** A user maintaining a parallel structure tied to `items` (an external index, a heap, a count) needs a hook to update it on remove. The hook makes that maintenance possible without forcing every `select()` user to also override `pick` / `insert`.

For typical callers the default is exactly what they want — the hook is opt-in.

## Lifecycle

### Initial fill

Initial fill is asynchronous and parallel across streams: each stream pulls up to `windowSize` items, and all N streams' pull-loops run concurrently. Per-stream pulls are sequential (one after another); cross-stream, they're concurrent. Total wait is the slowest stream's `windowSize` pulls — not the sum across streams.

```js
await Promise.all(
  streams.map(async (s, streamIndex) => {
    for (let i = 0; i < windowSize; ++i) {
      const r = await pullers[streamIndex].next();
      if (r.done) {
        exhausted[streamIndex] = true;
        return; // stop pulling from this stream
      }
      insert(items, {item: r.value, index: streamIndex}, undefined);
    }
  })
);
```

JavaScript single-threading means `insert` calls are serialized between `await` points — no race condition on the shared `items` mutation, even though pulls run in parallel.

Insertion order is whatever order results complete in across streams, which is non-deterministic. Within a stream, items insert in stream order (pull 0, then pull 1, etc.). `sortedInsert` doesn't care about insertion order. Default-insert (`push`) callers see interleaved arrival order — also fine; they're not relying on stream-major layout.

### Steady state

After initial fill, the system enters its main loop:

```js
while (items.length > 0) {
  const pos = pick(items);
  if (!isValidIndex(pos, items.length)) break; // stop signal

  const slot = items[pos];
  output.push(slot.item);

  if (exhausted[slot.index]) {
    remove(items, pos);
    continue;
  }
  const r = await pullers[slot.index].next();
  if (r.done) {
    exhausted[slot.index] = true;
    remove(items, pos);
  } else {
    insert(items, {item: r.value, index: slot.index}, pos);
  }
}
output.push(null); // end
```

The `exhausted[]` flag is an optimization for `windowSize > 1`: once a stream's puller has returned `{done: true}`, subsequent slots from that same stream will too. Track the flag and skip the `await pullers[].next()` call for those — just `remove`. Saves a microtask per slot in the late-game.

### Steady-state size

`items.length` starts at up to `N × windowSize` after initial fill. As streams exhaust, `remove` shrinks it. Once every stream is exhausted, the remaining slots drain one per pick until length 0. The "working size" of the buffer naturally tracks how many streams are still live, which means memory usage in the late game is bounded by `liveStreams × windowSize`, not `N × windowSize`. Worth a note in the readme so users understand the late-run memory profile.

## `sortedInsert(lessFn)` — the headline helper

Uses [`nano-binary-search`](https://www.npmjs.com/package/nano-binary-search) to find the insertion point. Crucially, the helper detects when the new slot belongs at the same logical position as the just-removed slot — in which case it does an in-place replace (one assignment) instead of two `splice` calls. This is the common case for sorted streams: a sorted stream's next item is usually "close to" the previous one in global key order, so the new slot's position often matches `lastPos`.

Sketch:

```js
const binarySearch = require('nano-binary-search');

const sortedInsert = lessFn => (items, newSlot, lastPos) => {
  // The user's lessFn compares item values; wrap to compare slots.
  const pred = slot => lessFn(slot.item, newSlot.item);

  if (lastPos === undefined) {
    // Initial fill: binary-search and splice in.
    items.splice(binarySearch(items, pred), 0, newSlot);
    return;
  }

  // Post-pick refill: find where newSlot belongs in the full array.
  const pos = binarySearch(items, pred);

  // Smart-replace check: does newSlot belong exactly where items[lastPos] is?
  //   pos === lastPos       → newSlot belongs immediately before items[lastPos]
  //   pos === lastPos + 1   → newSlot belongs immediately after items[lastPos]
  // In either case, if we remove items[lastPos] and reinsert newSlot, it lands at lastPos.
  // Single assignment, no splice.
  if (pos === lastPos || pos === lastPos + 1) {
    items[lastPos] = newSlot;
    return;
  }

  // Otherwise: two splices, in an order that preserves the insertion index.
  if (pos < lastPos) {
    // Insert first (shifts lastPos to lastPos+1), then remove the old.
    items.splice(pos, 0, newSlot);
    items.splice(lastPos + 1, 1);
  } else {
    // pos > lastPos + 1: remove first (pulls higher indices down by 1), then insert at pos-1.
    items.splice(lastPos, 1);
    items.splice(pos - 1, 0, newSlot);
  }
};
```

`lessFn(a, b)` is the user's "a should come before b" predicate over **item values** (not slots). The helper unwraps slot → item internally, so the user writes one comparator over their domain values and uses the same one in `sortedInsert` and any matching picker.

## `pickMin(lessFn)` and `pickFirst` — companion helpers

```js
const pickMin = lessFn => items => {
  let min = 0;
  for (let i = 1; i < items.length; ++i) {
    if (lessFn(items[i].item, items[min].item)) min = i;
  }
  return min;
};
```

Linear scan, O(items.length) per pick. Cache-friendly, branch-predictable, zero allocations. `lessFn` operates on item values (the helper unwraps slot → item internally), matching `sortedInsert`'s convention so the same comparator can be reused if both are wired in.

No defensive `if (!items.length) return` — the system never calls `pick` when `items.length === 0` (the steady-state loop checks first). Trust the contract.

For arrays maintained in sorted order via `sortedInsert`, the smallest slot is always at index 0; the linear scan is wasted work. Use `pickFirst` instead:

```js
const pickFirst = () => 0;
```

That's the whole implementation. Constant time, no comparisons. The sortedInsert invariant carries correctness.

A single `mergeSorted(streams, lessFn, opts?)` umbrella helper that wires `pickFirst + sortedInsert(lessFn)` together covers the headline k-way-merge use case (and stream-sorting's merge phase) in one line:

```js
const mergeSorted = (streams, lessFn, opts) =>
  select(streams, {
    pick: pickFirst,
    insert: sortedInsert(lessFn),
    ...opts
  });
```

## The per-stream puller

Both `zip()` and `select()` need to ask a Readable for its next item with `await` semantics. Node's `[Symbol.asyncIterator]()` is the wrong tool for this:

- It wraps the original `'error'` value in an `AbortError` during teardown, losing the cause.
- Async iteration on streams has been a moving target across Node minor releases; relying on it locks the library to a specific version's quirks.
- The current `zip()` implementation (2.0.0) works around the error-wrap with a side-listener hack, which is its own complexity.

Instead, both components share a small event-based wrapper. **All internal stream reads in `select()` go through this puller — there is no use of `[Symbol.asyncIterator]()` anywhere in the implementation.**

```js
const makeStreamPuller = stream => {
  const queue = []; // buffered items
  const waiters = []; // {resolve, reject} for pending pulls
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
    errored = err;
    while (waiters.length) waiters.shift().reject(err);
  };
  stream.on('data', onData).on('end', onEnd).on('error', onError);

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
  const close = () => stream.off('data', onData).off('end', onEnd).off('error', onError);

  return {next, close};
};
```

Backpressure: `stream.pause()` when an item arrives with no waiter; `stream.resume()` when a waiter exists or the local queue drains. Errors come through with the original value, no wrapper. Cleanup is three `.off(...)` calls when the component is done with the stream.

Lives at `src/stream-puller.js` (or similar internal location, not exported). Shared by `zip()` and `select()`.

## Implications for `zip()`

`zip()` currently uses `[Symbol.asyncIterator]()` + a side-listener hack to recover the original error from the AbortError wrap. Once `makeStreamPuller` is in place, the natural follow-on is to refactor `zip()` onto it too:

- Single mechanism for both N→1 components.
- AbortError workaround goes away.
- Hot-loop allocations potentially shrink further (the iterator-creation overhead is gone).

Flag for `projects/stream-join/queue.md`; fold into a 2.1.0 release that ships `select()` and the puller-based `zip()` together.

## Open questions

- **`windowSize = 0` semantics.** Doesn't make sense; treat as error. Throw at the entry to `select()`. Negative / NaN / non-integer also throw.
- **What if a stream produces zero items?** Its initial-fill loop returns immediately on the first `{done: true}`, `exhausted[streamIndex]` is set, and no slot ever enters `items` from that stream. Other streams proceed normally. No special case needed in the steady-state loop.
- **What if `insert` produces an array longer than `N × windowSize`?** User violated the steady-state length invariant; subsequent `pick` operates on the larger array; nothing crashes but the windowSize bound is silently exceeded. Document but don't enforce — `Object.freeze` / length-check costs aren't worth catching this in the hot path.
- **`select` vs `pick` vs other names.** `select` is the function; `pick` is the user callback inside it. Avoids name collision. If a better function name surfaces during implementation, rename is cheap (one new file).

## Non-goals

- **No SQL-style key-based join.** That's a layer on top — `select()` + `sortedInsert` + a downstream `chain()` step that emits combined records when keys match. Worth a separate utility (`mergeJoin`?) but not part of `select`.
- **No sort.** Sort is `stream-sorting`'s job. `select()` assumes its input streams are however ordered the caller wants; it just selects.
- **No buffering beyond `N × windowSize`.** `select` is a streaming primitive with bounded memory. Callers who need more buffering compose it with batching utilities.
- **No async pick / insert / remove.** All three callbacks are synchronous. If a use case for async surfaces, the same conditional-await pattern from 2.0.0's `joinItems` applies; for now, sync only.
- **No `[Symbol.asyncIterator]()` on input streams.** Internal stream reads go exclusively through `makeStreamPuller`. The async-iterator interface on Node Readables is treated as experimental and avoided for production use.
