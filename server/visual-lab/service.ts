import { EventEmitter } from 'node:events';
import type { CommandResult, QueryResult } from '../../src/interface/protocol';
import type { VisualConfiguration, VisualLabCommand, VisualLabQuery, VisualLabState, VisualProfile, VisualProfileSummary } from '../../src/visual-lab/types';
import { VISUAL_SCHEMA_VERSION, normalizeVisualConfiguration, visualRegistry } from '../../src/visual-lab/registry';
import { builtInProfiles, configurationsDiffer, profileByName } from '../../src/visual-lab/profiles';
import { visualProfileHash } from './profile-hash';
import { VisualLabPersistence } from './persistence';

const HISTORY_LIMIT = 50;
function validName(name: string): string {
  const value = name.trim();
  if (!value || value.length > 80) throw new Error('Profile name must contain 1–80 characters');
  return value;
}

export class VisualLabService extends EventEmitter {
  private values: VisualConfiguration;
  private activeProfile = 'High Visibility';
  private profiles = new Map<string, VisualProfile>();
  private favorites: string[] = [];
  private showAdvanced = false;
  private favoritesOnly = false;
  private ab: { active?: 'A' | 'B'; A?: VisualConfiguration; B?: VisualConfiguration } = {};
  private undoStack: VisualConfiguration[] = [];
  private redoStack: VisualConfiguration[] = [];

  private constructor(private readonly persistence: VisualLabPersistence, initial?: Awaited<ReturnType<VisualLabPersistence['load']>>) {
    super();
    for (const profile of builtInProfiles) this.profiles.set(profile.name, profile);
    if (initial) {
      for (const profile of initial.profiles) this.profiles.set(profile.name, profile);
      this.values = initial.values; this.activeProfile = initial.activeProfile; this.favorites = initial.favorites;
      this.showAdvanced = initial.showAdvanced; this.favoritesOnly = initial.favoritesOnly; this.ab = initial.ab;
    } else this.values = profileByName('High Visibility')!.values;
  }

  static async create(path: string): Promise<VisualLabService> {
    const persistence = new VisualLabPersistence(path);
    return new VisualLabService(persistence, await persistence.load());
  }
  schema() { return { version: VISUAL_SCHEMA_VERSION, parameters: visualRegistry.list() }; }
  profilesList(): VisualProfileSummary[] {
    return [...this.profiles.values()].sort((a, b) => a.name < b.name ? -1 : 1).map((profile) => ({
      name: profile.name, hash: visualProfileHash(profile), builtIn: profile.builtIn,
      ...(profile.description ? { description: profile.description } : {}),
    }));
  }
  state(): VisualLabState {
    const profile = this.profiles.get(this.activeProfile);
    const identity = profile ? { ...profile, values: this.values } : { formatVersion: 1 as const, name: this.activeProfile, schemaVersion: VISUAL_SCHEMA_VERSION, values: this.values, builtIn: false };
    return {
      schemaVersion: VISUAL_SCHEMA_VERSION, values: this.values, activeProfile: this.activeProfile,
      activeProfileHash: visualProfileHash(identity), dirty: !profile || configurationsDiffer(this.values, profile.values).length > 0,
      canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0, favorites: [...this.favorites],
      showAdvanced: this.showAdvanced, favoritesOnly: this.favoritesOnly,
      ab: { ...this.ab, differingParameters: configurationsDiffer(this.ab.A, this.ab.B) },
    };
  }
  query(query: VisualLabQuery): QueryResult {
    switch (query.type) {
      case 'visual-lab/schema': return { ok: true, data: this.schema() };
      case 'visual-lab/state': return { ok: true, data: this.state() };
      case 'visual-lab/profiles/list': return { ok: true, data: this.profilesList() };
    }
  }
  async execute(command: VisualLabCommand): Promise<CommandResult> {
    try {
      const exported = await this.apply(command);
      return { ok: true, data: exported ?? this.state() };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : String(error) }; }
  }
  private async apply(command: VisualLabCommand): Promise<unknown> {
    switch (command.type) {
      case 'visual-lab/value/set': this.change({ ...this.values, [command.id]: visualRegistry.validate(command.id, command.value, command.clamp) }); break;
      case 'visual-lab/values/patch': {
        const next = { ...this.values };
        for (const [id, value] of Object.entries(command.values)) next[id] = visualRegistry.validate(id, value, command.clamp);
        this.change(next); break;
      }
      case 'visual-lab/reset-parameter': this.change({ ...this.values, [command.id]: visualRegistry.get(command.id).defaultValue }); break;
      case 'visual-lab/reset-group': {
        const next = { ...this.values };
        for (const item of visualRegistry.list().filter((item) => item.group === command.group)) next[item.id] = item.defaultValue;
        this.change(next); break;
      }
      case 'visual-lab/reset-all': this.change(visualRegistry.defaults()); this.activeProfile = 'HRU Default'; break;
      case 'visual-lab/undo': this.undo(); break;
      case 'visual-lab/redo': this.redo(); break;
      case 'visual-lab/profile/load': this.loadProfile(command.name); break;
      case 'visual-lab/profile/save': this.saveProfile(command.name, command.description); break;
      case 'visual-lab/profile/duplicate': this.duplicate(command.source, command.name); break;
      case 'visual-lab/profile/rename': this.rename(command.source, command.name); break;
      case 'visual-lab/profile/delete': this.delete(command.name); break;
      case 'visual-lab/profile/export': return JSON.stringify(this.requiredProfile(command.name), null, 2);
      case 'visual-lab/profile/import': this.import(command.json); break;
      case 'visual-lab/ab/store': this.ab = { ...this.ab, [command.slot]: structuredClone(this.values), active: command.slot }; break;
      case 'visual-lab/ab/toggle': {
        const target = this.ab.active === 'A' ? 'B' : 'A';
        if (!this.ab[target]) throw new Error(`A/B slot ${target} is empty`);
        this.change(this.ab[target]!); this.ab = { ...this.ab, active: target }; break;
      }
      case 'visual-lab/favorite/toggle': visualRegistry.get(command.id); this.favorites = this.favorites.includes(command.id) ? this.favorites.filter((id) => id !== command.id) : [...this.favorites, command.id].sort(); break;
      case 'visual-lab/preference/set': this[command.preference] = command.value; break;
    }
    await this.persist(); this.emit('change', this.state()); return undefined;
  }
  private change(values: VisualConfiguration): void { this.undoStack = [...this.undoStack, this.values].slice(-HISTORY_LIMIT); this.redoStack = []; this.values = normalizeVisualConfiguration(values); }
  private undo(): void { const previous = this.undoStack.pop(); if (!previous) return; this.redoStack = [...this.redoStack, this.values].slice(-HISTORY_LIMIT); this.values = previous; }
  private redo(): void { const next = this.redoStack.pop(); if (!next) return; this.undoStack = [...this.undoStack, this.values].slice(-HISTORY_LIMIT); this.values = next; }
  private requiredProfile(name: string): VisualProfile { const found = this.profiles.get(name); if (!found) throw new Error(`Unknown profile: ${name}`); return found; }
  private loadProfile(name: string): void { const profile = this.requiredProfile(name); this.change(profile.values); this.activeProfile = profile.name; }
  private saveProfile(name: string, description?: string): void {
    name = validName(name); if (profileByName(name)) throw new Error('Built-in profiles cannot be overwritten');
    const now = new Date().toISOString(); const existing = this.profiles.get(name);
    this.profiles.set(name, { formatVersion: 1, name, schemaVersion: VISUAL_SCHEMA_VERSION, values: this.values, builtIn: false, ...(description ? { description } : {}), metadata: { createdAt: existing?.metadata?.createdAt ?? now, updatedAt: now } }); this.activeProfile = name;
  }
  private duplicate(source: string, name: string): void { const original = this.requiredProfile(source); name = validName(name); if (this.profiles.has(name)) throw new Error('Profile already exists'); this.profiles.set(name, { ...original, name, builtIn: false, metadata: { createdAt: new Date().toISOString() } }); }
  private rename(source: string, name: string): void { const profile = this.requiredProfile(source); if (profile.builtIn) throw new Error('Built-in profiles cannot be renamed'); name = validName(name); if (this.profiles.has(name)) throw new Error('Profile already exists'); this.profiles.delete(source); this.profiles.set(name, { ...profile, name }); if (this.activeProfile === source) this.activeProfile = name; }
  private delete(name: string): void { const profile = this.requiredProfile(name); if (profile.builtIn) throw new Error('Built-in profiles cannot be deleted'); this.profiles.delete(name); if (this.activeProfile === name) this.loadProfile('High Visibility'); }
  private import(json: string): void {
    let parsed: unknown; try { parsed = JSON.parse(json); } catch { throw new Error('Profile import is not valid JSON'); }
    if (typeof parsed !== 'object' || !parsed) throw new Error('Malformed visual profile');
    const profile = parsed as VisualProfile;
    if (profile.formatVersion !== 1 || profile.schemaVersion !== VISUAL_SCHEMA_VERSION || typeof profile.name !== 'string' || profile.builtIn !== false) throw new Error('Incompatible or malformed visual profile');
    if (!profile.values || Object.keys(profile.values).length !== visualRegistry.list().length) throw new Error('Imported profile must contain every registered value exactly once');
    const name = validName(profile.name); if (this.profiles.has(name) || profileByName(name)) throw new Error('Profile already exists');
    this.profiles.set(name, { ...profile, name, values: normalizeVisualConfiguration(profile.values), builtIn: false }); this.loadProfile(name);
  }
  private async persist(): Promise<void> { await this.persistence.save({ values: this.values, activeProfile: this.activeProfile, profiles: [...this.profiles.values()].filter((profile) => !profile.builtIn), favorites: this.favorites, showAdvanced: this.showAdvanced, favoritesOnly: this.favoritesOnly, ab: this.ab }); }
}
