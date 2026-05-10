/**
 * Typed wrappers for the server's command catalog
 * (see `plan/commands/command_types.md`).
 *
 * These are thin delegators around `PanaudiaClient.command(name, args)`.
 * Use them for autocomplete and arg checking; fall back to `command()`
 * directly for any new server command not yet wrapped here.
 *
 * Strict-MVC: each call fires-and-forgets. Effects arrive later as
 * echoed entity / space ops via the existing subscriber path.
 */

interface CommandDispatcher {
  command(name: string, args?: Record<string, unknown>): Promise<void>;
}

export interface SpaceEntityCommands {
  mute(entityId: string): Promise<void>;
  unmute(entityId: string): Promise<void>;
  /** `mins = 0` means kick forever. */
  kick(entityId: string, mins: number): Promise<void>;
  unkick(entityId: string): Promise<void>;
  setGain(entityId: string, gain: number): Promise<void>;
  setAttenuation(entityId: string, attenuation: number): Promise<void>;
}

export interface SpaceRoleCommands {
  mute(role: string): Promise<void>;
  unmute(role: string): Promise<void>;
  /** `mins = 0` means kick forever. */
  kick(role: string, mins: number): Promise<void>;
  unkick(role: string): Promise<void>;
  setGain(role: string, gain: number): Promise<void>;
  unsetGain(role: string): Promise<void>;
  setAttenuation(role: string, attenuation: number): Promise<void>;
  unsetAttenuation(role: string): Promise<void>;
}

export interface PersonalEntityCommands {
  mute(entityId: string): Promise<void>;
  unmute(entityId: string): Promise<void>;
  solo(entityId: string): Promise<void>;
  unsolo(entityId: string): Promise<void>;
}

export interface PersonalRoleCommands {
  mute(role: string): Promise<void>;
  unmute(role: string): Promise<void>;
}

export interface CommandsAPI {
  space: {
    entity: SpaceEntityCommands;
    role: SpaceRoleCommands;
  };
  personal: {
    entity: PersonalEntityCommands;
    role: PersonalRoleCommands;
  };
}

export function createCommandsAPI(client: CommandDispatcher): CommandsAPI {
  return {
    space: {
      entity: {
        mute: (entityId) => client.command('space.entity.mute', { entity_id: entityId }),
        unmute: (entityId) => client.command('space.entity.unmute', { entity_id: entityId }),
        kick: (entityId, mins) =>
          client.command('space.entity.kick', { entity_id: entityId, mins }),
        unkick: (entityId) => client.command('space.entity.unkick', { entity_id: entityId }),
        setGain: (entityId, gain) =>
          client.command('space.entity.set_gain', { entity_id: entityId, gain }),
        setAttenuation: (entityId, attenuation) =>
          client.command('space.entity.set_attenuation', {
            entity_id: entityId,
            attenuation,
          }),
      },
      role: {
        mute: (role) => client.command('space.role.mute', { role }),
        unmute: (role) => client.command('space.role.unmute', { role }),
        kick: (role, mins) => client.command('space.role.kick', { role, mins }),
        unkick: (role) => client.command('space.role.unkick', { role }),
        setGain: (role, gain) => client.command('space.role.set_gain', { role, gain }),
        unsetGain: (role) => client.command('space.role.unset_gain', { role }),
        setAttenuation: (role, attenuation) =>
          client.command('space.role.set_attenuation', { role, attenuation }),
        unsetAttenuation: (role) => client.command('space.role.unset_attenuation', { role }),
      },
    },
    personal: {
      entity: {
        mute: (entityId) => client.command('personal.entity.mute', { entity_id: entityId }),
        unmute: (entityId) =>
          client.command('personal.entity.unmute', { entity_id: entityId }),
        solo: (entityId) => client.command('personal.entity.solo', { entity_id: entityId }),
        unsolo: (entityId) =>
          client.command('personal.entity.unsolo', { entity_id: entityId }),
      },
      role: {
        mute: (role) => client.command('personal.role.mute', { role }),
        unmute: (role) => client.command('personal.role.unmute', { role }),
      },
    },
  };
}
