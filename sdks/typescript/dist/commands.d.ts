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
export declare function createCommandsAPI(client: CommandDispatcher): CommandsAPI;
export {};
//# sourceMappingURL=commands.d.ts.map