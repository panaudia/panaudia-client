import { describe, it, expect, vi } from 'vitest';
import { createCommandsAPI } from '../src/commands.js';

describe('createCommandsAPI', () => {
  function makeStub() {
    const command = vi.fn().mockResolvedValue(undefined);
    const api = createCommandsAPI({ command });
    return { command, api };
  }

  describe('space.entity', () => {
    it('mute', async () => {
      const { command, api } = makeStub();
      await api.space.entity.mute('uuid-A');
      expect(command).toHaveBeenCalledWith('space.entity.mute', { entity_id: 'uuid-A' });
    });

    it('unmute', async () => {
      const { command, api } = makeStub();
      await api.space.entity.unmute('uuid-A');
      expect(command).toHaveBeenCalledWith('space.entity.unmute', { entity_id: 'uuid-A' });
    });

    it('kick', async () => {
      const { command, api } = makeStub();
      await api.space.entity.kick('uuid-A', 5);
      expect(command).toHaveBeenCalledWith('space.entity.kick', {
        entity_id: 'uuid-A',
        mins: 5,
      });
    });

    it('kick with mins=0 means forever', async () => {
      const { command, api } = makeStub();
      await api.space.entity.kick('uuid-A', 0);
      expect(command).toHaveBeenCalledWith('space.entity.kick', {
        entity_id: 'uuid-A',
        mins: 0,
      });
    });

    it('unkick', async () => {
      const { command, api } = makeStub();
      await api.space.entity.unkick('uuid-A');
      expect(command).toHaveBeenCalledWith('space.entity.unkick', { entity_id: 'uuid-A' });
    });

    it('setGain', async () => {
      const { command, api } = makeStub();
      await api.space.entity.setGain('uuid-A', 1.5);
      expect(command).toHaveBeenCalledWith('space.entity.set_gain', {
        entity_id: 'uuid-A',
        gain: 1.5,
      });
    });

    it('setAttenuation', async () => {
      const { command, api } = makeStub();
      await api.space.entity.setAttenuation('uuid-A', 2.5);
      expect(command).toHaveBeenCalledWith('space.entity.set_attenuation', {
        entity_id: 'uuid-A',
        attenuation: 2.5,
      });
    });
  });

  describe('space.role', () => {
    it('mute', async () => {
      const { command, api } = makeStub();
      await api.space.role.mute('performer');
      expect(command).toHaveBeenCalledWith('space.role.mute', { role: 'performer' });
    });

    it('unmute', async () => {
      const { command, api } = makeStub();
      await api.space.role.unmute('performer');
      expect(command).toHaveBeenCalledWith('space.role.unmute', { role: 'performer' });
    });

    it('kick', async () => {
      const { command, api } = makeStub();
      await api.space.role.kick('audience', 10);
      expect(command).toHaveBeenCalledWith('space.role.kick', {
        role: 'audience',
        mins: 10,
      });
    });

    it('unkick', async () => {
      const { command, api } = makeStub();
      await api.space.role.unkick('audience');
      expect(command).toHaveBeenCalledWith('space.role.unkick', { role: 'audience' });
    });

    it('setGain', async () => {
      const { command, api } = makeStub();
      await api.space.role.setGain('performer', 2.0);
      expect(command).toHaveBeenCalledWith('space.role.set_gain', {
        role: 'performer',
        gain: 2.0,
      });
    });

    it('unsetGain', async () => {
      const { command, api } = makeStub();
      await api.space.role.unsetGain('performer');
      expect(command).toHaveBeenCalledWith('space.role.unset_gain', { role: 'performer' });
    });

    it('setAttenuation', async () => {
      const { command, api } = makeStub();
      await api.space.role.setAttenuation('performer', 1.5);
      expect(command).toHaveBeenCalledWith('space.role.set_attenuation', {
        role: 'performer',
        attenuation: 1.5,
      });
    });

    it('unsetAttenuation', async () => {
      const { command, api } = makeStub();
      await api.space.role.unsetAttenuation('performer');
      expect(command).toHaveBeenCalledWith('space.role.unset_attenuation', {
        role: 'performer',
      });
    });
  });

  describe('personal.entity', () => {
    it('mute', async () => {
      const { command, api } = makeStub();
      await api.personal.entity.mute('uuid-B');
      expect(command).toHaveBeenCalledWith('personal.entity.mute', { entity_id: 'uuid-B' });
    });

    it('unmute', async () => {
      const { command, api } = makeStub();
      await api.personal.entity.unmute('uuid-B');
      expect(command).toHaveBeenCalledWith('personal.entity.unmute', {
        entity_id: 'uuid-B',
      });
    });

    it('solo', async () => {
      const { command, api } = makeStub();
      await api.personal.entity.solo('uuid-B');
      expect(command).toHaveBeenCalledWith('personal.entity.solo', { entity_id: 'uuid-B' });
    });

    it('unsolo', async () => {
      const { command, api } = makeStub();
      await api.personal.entity.unsolo('uuid-B');
      expect(command).toHaveBeenCalledWith('personal.entity.unsolo', {
        entity_id: 'uuid-B',
      });
    });
  });

  describe('personal.role', () => {
    it('mute', async () => {
      const { command, api } = makeStub();
      await api.personal.role.mute('performer');
      expect(command).toHaveBeenCalledWith('personal.role.mute', { role: 'performer' });
    });

    it('unmute', async () => {
      const { command, api } = makeStub();
      await api.personal.role.unmute('performer');
      expect(command).toHaveBeenCalledWith('personal.role.unmute', { role: 'performer' });
    });
  });

  it('returns the same api shape on every call (no shared state)', () => {
    const { api: a } = makeStub();
    const { api: b } = makeStub();
    expect(Object.keys(a)).toEqual(Object.keys(b));
    expect(Object.keys(a.space)).toEqual(['entity', 'role']);
    expect(Object.keys(a.personal)).toEqual(['entity', 'role']);
  });
});
