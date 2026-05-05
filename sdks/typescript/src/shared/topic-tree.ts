/**
 * Structured per-uuid view of a flat-key topic stream.
 *
 * Topic ops use keys of the form `{uuid}.<dotted.path>`, where the first
 * segment is always the entity uuid. TopicTree groups incoming leaves by
 * uuid and reconstructs the nested JSON object so applications can read
 * `tree.get(uuid).ticket.colour` instead of working with a flat `CacheMap`
 * of dotted keys. The shape is topic-agnostic — the same class powers the
 * `attributes` tree (per-participant attributes) and the `entity` tree
 * (per-entity server-internal config).
 *
 * For new uuids the whole record is built off to the side and only
 * inserted into the tree once fully populated, so a consumer reading the
 * tree mid-batch never sees a partially initialised record.
 */

export type TopicNode = { [key: string]: unknown };

export interface TopicValue {
  key: string;
  value: string;
}

export class TopicTree {
  private records: Map<string, TopicNode> = new Map();

  /**
   * Apply a batch of values from one envelope.
   * Existing uuids are mutated in place; new uuids are built fully then
   * inserted atomically. Returns the set of uuids whose subtree changed.
   */
  applyValues(values: ReadonlyArray<TopicValue>): Set<string> {
    const affected = new Set<string>();
    const fresh = new Map<string, TopicNode>();

    for (const { key, value } of values) {
      const parts = key.split('.');
      const uuid = parts[0];
      if (!uuid) continue;

      let target = fresh.get(uuid) ?? this.records.get(uuid);
      if (target === undefined) {
        target = {};
        fresh.set(uuid, target);
      }

      affected.add(uuid);

      if (parts.length === 1) {
        // Bare uuid — known but nothing to set
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        continue;
      }

      let node = target;
      for (let i = 1; i < parts.length - 1; i++) {
        const seg = parts[i]!;
        const child = node[seg];
        if (typeof child !== 'object' || child === null || Array.isArray(child)) {
          node[seg] = {};
        }
        node = node[seg] as TopicNode;
      }
      node[parts[parts.length - 1]!] = parsed;
    }

    for (const [uuid, attrs] of fresh) {
      this.records.set(uuid, attrs);
    }

    return affected;
  }

  /**
   * Apply a batch of tombstones from one envelope.
   * Walks the dotted path for each key and removes the leaf, cleaning up
   * empty intermediate objects. Returns the set of uuids that still have
   * data (`updated`) and uuids whose last leaf was removed (`removed`).
   */
  applyRemoved(keys: ReadonlyArray<string>): { updated: Set<string>; removed: Set<string> } {
    const touched = new Set<string>();

    for (const key of keys) {
      const parts = key.split('.');
      const uuid = parts[0];
      if (!uuid) continue;

      const target = this.records.get(uuid);
      if (target === undefined) continue;

      touched.add(uuid);

      if (parts.length === 1) {
        this.records.delete(uuid);
        continue;
      }

      this.deletePath(target, parts, 1);

      if (Object.keys(target).length === 0) {
        this.records.delete(uuid);
      }
    }

    const updated = new Set<string>();
    const removed = new Set<string>();
    for (const uuid of touched) {
      if (this.records.has(uuid)) {
        updated.add(uuid);
      } else {
        removed.add(uuid);
      }
    }
    return { updated, removed };
  }

  /**
   * Get the record for a single uuid.
   */
  get(uuid: string): TopicNode | undefined {
    return this.records.get(uuid);
  }

  /**
   * Get the full tree as a read-only map of `uuid -> record`.
   */
  getAll(): ReadonlyMap<string, TopicNode> {
    return this.records;
  }

  /**
   * Number of records in the tree.
   */
  get size(): number {
    return this.records.size;
  }

  /**
   * Drop all records.
   */
  clear(): void {
    this.records.clear();
  }

  private deletePath(node: TopicNode, parts: string[], index: number): void {
    const seg = parts[index]!;
    if (index === parts.length - 1) {
      delete node[seg];
      return;
    }
    const child = node[seg];
    if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
      this.deletePath(child as TopicNode, parts, index + 1);
      if (Object.keys(child).length === 0) {
        delete node[seg];
      }
    }
  }
}
