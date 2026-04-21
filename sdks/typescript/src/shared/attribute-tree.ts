/**
 * Structured per-participant view of attribute state.
 *
 * Attribute keys follow the convention `{uuid}.<dotted.path>`, where the first
 * segment is always the participant's uuid. AttributeTree groups incoming
 * leaves by uuid and reconstructs the nested JSON object so applications can
 * read `tree.get(uuid).ticket.colour` instead of working with the flat
 * `CacheMap` of dotted keys.
 *
 * For new uuids the whole attribute object is built off to the side and only
 * inserted into the tree once fully populated, so a consumer reading the tree
 * mid-batch never sees a partially initialised participant.
 */

export type AttributeNode = { [key: string]: unknown };

export interface AttributeValue {
  key: string;
  value: string;
}

export class AttributeTree {
  private participants: Map<string, AttributeNode> = new Map();

  /**
   * Apply a batch of attribute values from one envelope.
   * Existing uuids are mutated in place; new uuids are built fully then
   * inserted atomically. Returns the set of uuids whose subtree changed.
   */
  applyValues(values: ReadonlyArray<AttributeValue>): Set<string> {
    const affected = new Set<string>();
    const fresh = new Map<string, AttributeNode>();

    for (const { key, value } of values) {
      const parts = key.split('.');
      const uuid = parts[0];
      if (!uuid) continue;

      let target = fresh.get(uuid) ?? this.participants.get(uuid);
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
        node = node[seg] as AttributeNode;
      }
      node[parts[parts.length - 1]!] = parsed;
    }

    for (const [uuid, attrs] of fresh) {
      this.participants.set(uuid, attrs);
    }

    return affected;
  }

  /**
   * Apply a batch of tombstones from one envelope.
   * Walks the dotted path for each key and removes the leaf, cleaning up
   * empty intermediate objects. Returns the set of uuids that still have
   * data (`updated`) and uuids whose last attribute was removed (`removed`).
   */
  applyRemoved(keys: ReadonlyArray<string>): { updated: Set<string>; removed: Set<string> } {
    const touched = new Set<string>();

    for (const key of keys) {
      const parts = key.split('.');
      const uuid = parts[0];
      if (!uuid) continue;

      const target = this.participants.get(uuid);
      if (target === undefined) continue;

      touched.add(uuid);

      if (parts.length === 1) {
        this.participants.delete(uuid);
        continue;
      }

      this.deletePath(target, parts, 1);

      if (Object.keys(target).length === 0) {
        this.participants.delete(uuid);
      }
    }

    const updated = new Set<string>();
    const removed = new Set<string>();
    for (const uuid of touched) {
      if (this.participants.has(uuid)) {
        updated.add(uuid);
      } else {
        removed.add(uuid);
      }
    }
    return { updated, removed };
  }

  /**
   * Get the attribute object for a single participant.
   */
  get(uuid: string): AttributeNode | undefined {
    return this.participants.get(uuid);
  }

  /**
   * Get the full tree as a read-only map of `uuid -> attributes`.
   */
  getAll(): ReadonlyMap<string, AttributeNode> {
    return this.participants;
  }

  /**
   * Number of participants in the tree.
   */
  get size(): number {
    return this.participants.size;
  }

  /**
   * Drop all participants.
   */
  clear(): void {
    this.participants.clear();
  }

  private deletePath(node: AttributeNode, parts: string[], index: number): void {
    const seg = parts[index]!;
    if (index === parts.length - 1) {
      delete node[seg];
      return;
    }
    const child = node[seg];
    if (typeof child === 'object' && child !== null && !Array.isArray(child)) {
      this.deletePath(child as AttributeNode, parts, index + 1);
      if (Object.keys(child).length === 0) {
        delete node[seg];
      }
    }
  }
}
