/**
 * Single-record view of a flat-key topic stream — the rootless
 * counterpart to `TopicTree`.
 *
 * `TopicTree` groups incoming leaves by the first dotted segment
 * (always a uuid) and reconstructs one nested object per uuid. The
 * `space` topic, however, has no per-uuid prefix: keys look like
 * `roles-muted.{role}` / `roles-kicked.{role}` / `roles-gain.{role}`
 * / `roles-attenuation.{role}`. The reconstructed shape is a single
 * record:
 *
 *   {
 *     "roles-muted":       { "performer": true, ... },
 *     "roles-kicked":      { "performer": 1738273645000, ... },
 *     "roles-gain":        { "performer": 1.5, ... },
 *     "roles-attenuation": { "performer": 2.0, ... },
 *   }
 *
 * Same merge semantics as `TopicTree.applyValues` / `applyRemoved`
 * but keyed at the root instead of per-uuid. Out-of-order arrivals
 * are not the merger's concern — `TopicMerger` already filters stale
 * ops by opId before they reach this tree, so applyValues can write
 * blindly.
 */

export type SingleRecordNode = { [key: string]: unknown };

export interface SingleRecordValue {
  key: string;
  value: string;
}

export class SingleRecordTree {
  private record: SingleRecordNode = {};

  /**
   * Apply a batch of values from one envelope. Existing leaves are
   * overwritten; intermediate path segments are created on demand.
   * Returns true if any leaf changed (the unified client uses this
   * to decide whether to emit a tree-change event).
   */
  applyValues(values: ReadonlyArray<SingleRecordValue>): boolean {
    let changed = false;
    for (const { key, value } of values) {
      const parts = key.split('.');
      if (parts.length === 0 || parts[0] === '') continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        continue;
      }

      let node = this.record;
      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i]!;
        const child = node[seg];
        if (typeof child !== 'object' || child === null || Array.isArray(child)) {
          node[seg] = {};
        }
        node = node[seg] as SingleRecordNode;
      }
      const leaf = parts[parts.length - 1]!;
      node[leaf] = parsed;
      changed = true;
    }
    return changed;
  }

  /**
   * Apply a batch of tombstones from one envelope. Walks the dotted
   * path for each key and removes the leaf, cleaning up empty
   * intermediate objects. Returns true if anything was removed.
   */
  applyRemoved(keys: ReadonlyArray<string>): boolean {
    let changed = false;
    for (const key of keys) {
      const parts = key.split('.');
      if (parts.length === 0 || parts[0] === '') continue;
      if (this.deletePath(this.record, parts, 0)) {
        changed = true;
      }
    }
    return changed;
  }

  /** Get the entire reconstructed record as a read-only object. */
  get(): Readonly<SingleRecordNode> {
    return this.record;
  }

  /** Number of top-level fields in the record. */
  get size(): number {
    return Object.keys(this.record).length;
  }

  /** Drop all entries. */
  clear(): void {
    this.record = {};
  }

  private deletePath(node: SingleRecordNode, parts: string[], index: number): boolean {
    const seg = parts[index]!;
    if (index === parts.length - 1) {
      if (seg in node) {
        delete node[seg];
        return true;
      }
      return false;
    }
    const child = node[seg];
    if (typeof child !== 'object' || child === null || Array.isArray(child)) {
      return false;
    }
    const removed = this.deletePath(child as SingleRecordNode, parts, index + 1);
    if (removed && Object.keys(child).length === 0) {
      delete node[seg];
    }
    return removed;
  }
}
