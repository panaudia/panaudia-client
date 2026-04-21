import { describe, it, expect } from 'vitest';
import { AttributeTree } from '../src/shared/attribute-tree.js';

const v = (key: string, value: unknown) => ({ key, value: JSON.stringify(value) });

describe('AttributeTree', () => {
  describe('applyValues', () => {
    it('reconstructs nested objects from dotted keys', () => {
      const tree = new AttributeTree();
      tree.applyValues([
        v('alice.name', 'Alice'),
        v('alice.ticket.colour', '#ff6633'),
        v('alice.ticket.role', 'performer'),
      ]);

      expect(tree.get('alice')).toEqual({
        name: 'Alice',
        ticket: { colour: '#ff6633', role: 'performer' },
      });
    });

    it('groups multiple uuids in one batch', () => {
      const tree = new AttributeTree();
      const affected = tree.applyValues([
        v('alice.name', 'Alice'),
        v('bob.name', 'Bob'),
        v('alice.ticket.colour', '#f00'),
      ]);

      expect(affected).toEqual(new Set(['alice', 'bob']));
      expect(tree.get('alice')).toEqual({ name: 'Alice', ticket: { colour: '#f00' } });
      expect(tree.get('bob')).toEqual({ name: 'Bob' });
    });

    it('mutates existing entries in place', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('alice.name', 'Alice')]);
      const before = tree.get('alice');

      tree.applyValues([v('alice.ticket.colour', '#f00')]);
      const after = tree.get('alice');

      expect(after).toBe(before); // same object reference
      expect(after).toEqual({ name: 'Alice', ticket: { colour: '#f00' } });
    });

    it('builds new participants fully before publishing (no partial visibility)', () => {
      // Verify by inspecting state at each step rather than racing.
      const tree = new AttributeTree();
      expect(tree.get('alice')).toBeUndefined();

      const affected = tree.applyValues([
        v('alice.name', 'Alice'),
        v('alice.ticket.colour', '#f00'),
        v('alice.ticket.role', 'performer'),
      ]);

      expect(affected).toEqual(new Set(['alice']));
      const attrs = tree.get('alice');
      // The first time we read alice, all three fields are present.
      expect(attrs).toEqual({
        name: 'Alice',
        ticket: { colour: '#f00', role: 'performer' },
      });
    });

    it('replaces an object leaf when a primitive overwrites it', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('alice.ticket.colour', '#f00')]);
      tree.applyValues([v('alice.ticket', 'opaque')]);

      expect(tree.get('alice')).toEqual({ ticket: 'opaque' });
    });

    it('replaces a primitive leaf when a deeper key arrives', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('alice.ticket', 'opaque')]);
      tree.applyValues([v('alice.ticket.colour', '#f00')]);

      expect(tree.get('alice')).toEqual({ ticket: { colour: '#f00' } });
    });

    it('accepts JSON-encoded sub-objects as leaves (WebRTC fallback path)', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('alice.ticket', { colour: '#f00', role: 'performer' })]);

      expect(tree.get('alice')).toEqual({
        ticket: { colour: '#f00', role: 'performer' },
      });
    });

    it('skips entries with empty uuid', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('', 'oops'), v('.foo', 'bar')]);
      expect(tree.size).toBe(0);
    });

    it('skips entries with malformed JSON values', () => {
      const tree = new AttributeTree();
      tree.applyValues([
        { key: 'alice.name', value: 'not json' },
        v('alice.role', 'performer'),
      ]);
      expect(tree.get('alice')).toEqual({ role: 'performer' });
    });

    it('marks bare-uuid keys as known', () => {
      const tree = new AttributeTree();
      const affected = tree.applyValues([v('alice', null)]);
      expect(affected).toEqual(new Set(['alice']));
      expect(tree.get('alice')).toEqual({});
    });
  });

  describe('applyRemoved', () => {
    it('removes a single leaf', () => {
      const tree = new AttributeTree();
      tree.applyValues([
        v('alice.name', 'Alice'),
        v('alice.ticket.colour', '#f00'),
      ]);
      const { updated, removed } = tree.applyRemoved(['alice.ticket.colour']);

      expect(updated).toEqual(new Set(['alice']));
      expect(removed).toEqual(new Set());
      expect(tree.get('alice')).toEqual({ name: 'Alice' });
    });

    it('cleans up empty intermediate objects', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('alice.ticket.colour', '#f00')]);
      tree.applyRemoved(['alice.ticket.colour']);
      // ticket should be gone, and alice should be gone (last leaf removed)
      expect(tree.get('alice')).toBeUndefined();
    });

    it('removes the participant when the last leaf is tombstoned', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('alice.name', 'Alice')]);
      const { updated, removed } = tree.applyRemoved(['alice.name']);

      expect(updated).toEqual(new Set());
      expect(removed).toEqual(new Set(['alice']));
      expect(tree.get('alice')).toBeUndefined();
    });

    it('removes the participant when bare uuid is tombstoned', () => {
      const tree = new AttributeTree();
      tree.applyValues([
        v('alice.name', 'Alice'),
        v('alice.role', 'performer'),
      ]);
      const { removed } = tree.applyRemoved(['alice']);
      expect(removed).toEqual(new Set(['alice']));
      expect(tree.get('alice')).toBeUndefined();
    });

    it('handles bulk disconnect (one batch removing all of a participants keys)', () => {
      const tree = new AttributeTree();
      tree.applyValues([
        v('alice.name', 'Alice'),
        v('alice.ticket.colour', '#f00'),
        v('alice.ticket.role', 'performer'),
        v('bob.name', 'Bob'),
      ]);

      const { updated, removed } = tree.applyRemoved([
        'alice.name',
        'alice.ticket.colour',
        'alice.ticket.role',
      ]);

      expect(updated).toEqual(new Set());
      expect(removed).toEqual(new Set(['alice']));
      expect(tree.get('alice')).toBeUndefined();
      expect(tree.get('bob')).toEqual({ name: 'Bob' });
    });

    it('ignores tombstones for unknown participants', () => {
      const tree = new AttributeTree();
      const { updated, removed } = tree.applyRemoved(['ghost.name']);
      expect(updated.size).toBe(0);
      expect(removed.size).toBe(0);
    });

    it('ignores tombstones for unknown leaves of a known participant', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('alice.name', 'Alice')]);
      const { updated, removed } = tree.applyRemoved(['alice.ticket.colour']);
      // Touched but the leaf wasn't there; alice still has name, so updated.
      expect(updated).toEqual(new Set(['alice']));
      expect(removed.size).toBe(0);
      expect(tree.get('alice')).toEqual({ name: 'Alice' });
    });
  });

  describe('getAll / size / clear', () => {
    it('exposes the full tree as a read-only map', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('alice.name', 'Alice'), v('bob.name', 'Bob')]);
      const all = tree.getAll();
      expect(all.size).toBe(2);
      expect(all.get('alice')).toEqual({ name: 'Alice' });
      expect(all.get('bob')).toEqual({ name: 'Bob' });
    });

    it('reports size and clears', () => {
      const tree = new AttributeTree();
      tree.applyValues([v('alice.name', 'Alice')]);
      expect(tree.size).toBe(1);
      tree.clear();
      expect(tree.size).toBe(0);
      expect(tree.get('alice')).toBeUndefined();
    });
  });
});
