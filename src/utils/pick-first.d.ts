export = pickFirst;

/**
 * Always returns `0`. Pair with `sortedInsert` for k-way merge of sorted streams.
 */
declare const pickFirst: () => number;
