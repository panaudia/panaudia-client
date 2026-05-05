/**
 * SingleRecordTree — round-trip tests covering the rootless variant
 * of TopicTree used for the `space` topic.
 */

import { describe, it, expect } from 'vitest';
import { SingleRecordTree } from '../src/shared/single-record-tree.js';

describe('SingleRecordTree', () => {
  it('builds a single nested record from flat keys', () => {
    const t = new SingleRecordTree();
    const changed = t.applyValues([
      { key: 'roles-muted.performer', value: 'true' },
      { key: 'roles-muted.audience', value: 'true' },
      { key: 'roles-gain.performer', value: '1.5' },
    ]);
    expect(changed).toBe(true);
    expect(t.get()).toEqual({
      'roles-muted': { performer: true, audience: true },
      'roles-gain': { performer: 1.5 },
    });
  });

  it('overwrites existing leaves on subsequent applyValues', () => {
    const t = new SingleRecordTree();
    t.applyValues([{ key: 'roles-gain.performer', value: '1.0' }]);
    t.applyValues([{ key: 'roles-gain.performer', value: '2.5' }]);
    expect(t.get()).toEqual({ 'roles-gain': { performer: 2.5 } });
  });

  it('removes leaves and cleans up empty intermediates on applyRemoved', () => {
    const t = new SingleRecordTree();
    t.applyValues([
      { key: 'roles-muted.performer', value: 'true' },
      { key: 'roles-muted.audience', value: 'true' },
    ]);
    expect(t.applyRemoved(['roles-muted.performer'])).toBe(true);
    expect(t.get()).toEqual({ 'roles-muted': { audience: true } });

    expect(t.applyRemoved(['roles-muted.audience'])).toBe(true);
    expect(t.get()).toEqual({}); // intermediate 'roles-muted' cleaned up
  });

  it('returns false from applyValues when the input batch is empty', () => {
    const t = new SingleRecordTree();
    expect(t.applyValues([])).toBe(false);
    expect(t.get()).toEqual({});
  });

  it('returns false from applyRemoved for keys that were never set', () => {
    const t = new SingleRecordTree();
    expect(t.applyRemoved(['roles-muted.ghost'])).toBe(false);
  });

  it('skips malformed JSON values without affecting other keys in the batch', () => {
    const t = new SingleRecordTree();
    const changed = t.applyValues([
      { key: 'roles-muted.performer', value: 'not-json' },
      { key: 'roles-muted.audience', value: 'true' },
    ]);
    expect(changed).toBe(true);
    expect(t.get()).toEqual({ 'roles-muted': { audience: true } });
  });

  it('clear() drops all entries', () => {
    const t = new SingleRecordTree();
    t.applyValues([{ key: 'roles-muted.performer', value: 'true' }]);
    expect(t.size).toBe(1);
    t.clear();
    expect(t.size).toBe(0);
    expect(t.get()).toEqual({});
  });

  it('handles deep paths (defensive — current schema is two-deep)', () => {
    const t = new SingleRecordTree();
    t.applyValues([{ key: 'a.b.c', value: '"x"' }]);
    expect(t.get()).toEqual({ a: { b: { c: 'x' } } });
    t.applyRemoved(['a.b.c']);
    expect(t.get()).toEqual({}); // both intermediate levels cleaned up
  });
});
