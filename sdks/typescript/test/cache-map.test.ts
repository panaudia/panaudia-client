import { describe, it, expect, vi } from "vitest";
import { CacheMap } from "../src/shared/cache-map";
import type { CacheOp } from "../src/shared/cache-wire";

function makeOp(overrides: Partial<CacheOp> = {}): CacheOp {
  return {
    topic: "attributes",
    key: "node-1",
    value: new TextEncoder().encode('{"uuid":"node-1","name":"alice"}'),
    opId: 10n,
    nodeId: 0,
    tombstone: false,
    ...overrides,
  };
}

describe("CacheMap", () => {
  it("accepts first entry for a key", () => {
    const map = new CacheMap();
    const result = map.merge(makeOp());
    expect(result).toBe("accepted");
    expect(map.size).toBe(1);
    expect(map.get("node-1")?.opId).toBe(10n);
  });

  it("newer overwrites older", () => {
    const map = new CacheMap();
    map.merge(makeOp({ opId: 10n }));
    const result = map.merge(
      makeOp({ opId: 20n, value: new TextEncoder().encode("v2") })
    );
    expect(result).toBe("accepted");
    expect(new TextDecoder().decode(map.get("node-1")!.value)).toBe("v2");
  });

  it("older is rejected", () => {
    const map = new CacheMap();
    map.merge(makeOp({ opId: 20n }));
    const result = map.merge(makeOp({ opId: 10n }));
    expect(result).toBe("rejected");
    expect(map.get("node-1")?.opId).toBe(20n);
  });

  it("equal opId is rejected", () => {
    const map = new CacheMap();
    map.merge(makeOp({ opId: 10n }));
    const result = map.merge(
      makeOp({ opId: 10n, value: new TextEncoder().encode("different") })
    );
    expect(result).toBe("rejected");
  });

  it("tombstone removes entry", () => {
    const map = new CacheMap();
    map.merge(makeOp({ opId: 10n }));
    const result = map.merge(makeOp({ opId: 20n, tombstone: true }));
    expect(result).toBe("tombstoned");
    expect(map.get("node-1")).toBeUndefined();
    expect(map.size).toBe(0);
  });

  it("tombstone with lower opId is rejected", () => {
    const map = new CacheMap();
    map.merge(makeOp({ opId: 20n }));
    const result = map.merge(makeOp({ opId: 10n, tombstone: true }));
    expect(result).toBe("rejected");
    expect(map.size).toBe(1);
  });

  it("tombstone on absent key returns tombstoned without error", () => {
    const map = new CacheMap();
    const result = map.merge(makeOp({ opId: 5n, tombstone: true }));
    expect(result).toBe("tombstoned");
    expect(map.size).toBe(0);
  });

  it("tracks highest opId across all merges", () => {
    const map = new CacheMap();
    expect(map.getHighestOpId()).toBe(0n);
    map.merge(makeOp({ key: "a", opId: 10n }));
    map.merge(makeOp({ key: "b", opId: 30n }));
    map.merge(makeOp({ key: "c", opId: 20n }));
    expect(map.getHighestOpId()).toBe(30n);
  });

  it("highest opId updated even on rejected merges", () => {
    const map = new CacheMap();
    map.merge(makeOp({ opId: 20n }));
    map.merge(makeOp({ opId: 10n })); // rejected but opId=10 < 20, no change
    expect(map.getHighestOpId()).toBe(20n);
    // A rejected merge with higher opId from a different key context
    map.merge(makeOp({ key: "other", opId: 50n }));
    map.merge(makeOp({ key: "other", opId: 30n })); // rejected
    expect(map.getHighestOpId()).toBe(50n);
  });

  it("getAll returns all entries", () => {
    const map = new CacheMap();
    map.merge(makeOp({ key: "a", opId: 1n }));
    map.merge(makeOp({ key: "b", opId: 2n }));
    map.merge(makeOp({ key: "c", opId: 3n }));
    const all = map.getAll();
    expect(all.size).toBe(3);
    expect(all.get("b")?.opId).toBe(2n);
  });

  it("clear resets everything", () => {
    const map = new CacheMap();
    map.merge(makeOp({ key: "a", opId: 10n }));
    map.merge(makeOp({ key: "b", opId: 20n }));
    map.clear();
    expect(map.size).toBe(0);
    expect(map.getHighestOpId()).toBe(0n);
  });

  it("backfill and live interleaved — final state correct", () => {
    const map = new CacheMap();
    // Backfill arrives (lower opIds)
    map.merge(makeOp({ key: "a", opId: 5n }));
    map.merge(makeOp({ key: "b", opId: 6n }));
    // Live update arrives with higher opId for key 'a'
    map.merge(
      makeOp({ key: "a", opId: 15n, value: new TextEncoder().encode("live") })
    );
    // Late backfill for 'a' (stale, should be rejected)
    map.merge(makeOp({ key: "a", opId: 5n }));
    // Live tombstone for 'b'
    map.merge(makeOp({ key: "b", opId: 20n, tombstone: true }));

    expect(map.size).toBe(1);
    expect(new TextDecoder().decode(map.get("a")!.value)).toBe("live");
    expect(map.get("b")).toBeUndefined();
    expect(map.getHighestOpId()).toBe(20n);
  });

  it("many keys", () => {
    const map = new CacheMap();
    for (let i = 0; i < 500; i++) {
      map.merge(makeOp({ key: `node-${i}`, opId: BigInt(i + 1) }));
    }
    expect(map.size).toBe(500);
    expect(map.getHighestOpId()).toBe(500n);
  });

  describe("onChange handler", () => {
    it("fires on accepted", () => {
      const map = new CacheMap();
      const handler = vi.fn();
      map.onChange(handler);
      map.merge(makeOp({ opId: 10n }));
      expect(handler).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({ opId: 10n }),
        "accepted"
      );
    });

    it("fires on tombstone", () => {
      const map = new CacheMap();
      const handler = vi.fn();
      map.merge(makeOp({ opId: 10n }));
      map.onChange(handler);
      map.merge(makeOp({ opId: 20n, tombstone: true }));
      expect(handler).toHaveBeenCalledWith("node-1", null, "tombstoned");
    });

    it("does not fire on rejected", () => {
      const map = new CacheMap();
      map.merge(makeOp({ opId: 20n }));
      const handler = vi.fn();
      map.onChange(handler);
      map.merge(makeOp({ opId: 10n }));
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
