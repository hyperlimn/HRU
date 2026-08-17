import { EventEmitter } from "node:events";
import type { CommandResult, QueryResult } from "../../src/interface/protocol";
import type {
  VisualConfiguration,
  VisualLabCommand,
  VisualLabQuery,
  VisualLabState,
  VisualProfile,
  VisualProfileSummary,
} from "../../src/visual-lab/types";
import {
  VISUAL_SCHEMA_VERSION,
  normalizeVisualConfiguration,
  visualRegistry,
} from "../../src/visual-lab/registry";
import {
  visualLabCoverage,
  visualLabDiagnostics,
} from "../../src/visual-lab/visual-features";
import {
  builtInProfiles,
  configurationsDiffer,
  profileByName,
} from "../../src/visual-lab/profiles";
import { visualProfileHash } from "./profile-hash";
import { VisualLabPersistence } from "./persistence";
import { builtInRecipes, applyRecipe } from "../../src/visual-lab/recipes";
import {
  builtInPalettes,
  paletteHash,
  paletteById,
  PALETTE_ROLES,
} from "../../src/visual-lab/palettes";
import type { Palette } from "../../src/visual-lab/palettes";

const HISTORY_LIMIT = 50;
function validName(name: string): string {
  const value = name.trim();
  if (!value || value.length > 80)
    throw new Error("Profile name must contain 1–80 characters");
  return value;
}

export class VisualLabService extends EventEmitter {
  private values: VisualConfiguration;
  private activeProfile = "High Visibility";
  private profiles = new Map<string, VisualProfile>();
  private favorites: string[] = [];
  private showAdvanced = false;
  private favoritesOnly = false;
  private ab: {
    active?: "A" | "B";
    A?: VisualConfiguration;
    B?: VisualConfiguration;
  } = {};
  private undoStack: VisualConfiguration[] = [];
  private redoStack: VisualConfiguration[] = [];
  private palettes = new Map<string, Palette>();
  private paletteWarning?: string;
  private resultMessage?: string;
  private operation: Promise<void> = Promise.resolve();

  private constructor(
    private readonly persistence: VisualLabPersistence,
    initial?: Awaited<ReturnType<VisualLabPersistence["load"]>>,
    startupWarning?: string,
  ) {
    super();
    for (const profile of builtInProfiles)
      this.profiles.set(profile.name, profile);
    if (initial) {
      for (const profile of initial.profiles)
        this.profiles.set(profile.name, profile);
      this.values = initial.values;
      this.activeProfile = initial.activeProfile;
      this.favorites = initial.favorites;
      this.showAdvanced = initial.showAdvanced;
      this.favoritesOnly = initial.favoritesOnly;
      this.ab = initial.ab;
      for (const palette of initial.palettes)
        this.palettes.set(palette.id, palette);
    } else this.values = profileByName("High Visibility")!.values;
    this.paletteWarning = startupWarning;
  }

  static async create(path: string): Promise<VisualLabService> {
    const persistence = new VisualLabPersistence(path);
    const initial = await persistence.load();
    return new VisualLabService(persistence, initial, persistence.warning);
  }
  schema() {
    return {
      version: VISUAL_SCHEMA_VERSION,
      parameters: visualRegistry.list(),
    };
  }
  profilesList(): VisualProfileSummary[] {
    return [...this.profiles.values()]
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((profile) => ({
        name: profile.name,
        hash: visualProfileHash(profile),
        builtIn: profile.builtIn,
        ...(profile.description ? { description: profile.description } : {}),
      }));
  }
  state(): VisualLabState {
    const profile = this.profiles.get(this.activeProfile);
    const identity = profile
      ? { ...profile, values: this.values }
      : {
          formatVersion: 1 as const,
          name: this.activeProfile,
          schemaVersion: VISUAL_SCHEMA_VERSION,
          values: this.values,
          builtIn: false,
        };
    return {
      schemaVersion: VISUAL_SCHEMA_VERSION,
      values: this.values,
      activeProfile: this.activeProfile,
      ...(this.paletteWarning ? { paletteWarning: this.paletteWarning } : {}),
      activeProfileHash: visualProfileHash(identity),
      dirty:
        !profile ||
        configurationsDiffer(this.values, profile.values).length > 0,
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      favorites: [...this.favorites],
      showAdvanced: this.showAdvanced,
      favoritesOnly: this.favoritesOnly,
      ab: {
        ...this.ab,
        differingParameters: configurationsDiffer(this.ab.A, this.ab.B),
      },
    };
  }
  query(query: VisualLabQuery): QueryResult {
    switch (query.type) {
      case "visual-lab/schema":
        return { ok: true, data: this.schema() };
      case "visual-lab/state":
        return { ok: true, data: this.state() };
      case "visual-lab/profiles/list":
        return { ok: true, data: this.profilesList() };
      case "visual-lab/recipes/list":
        return { ok: true, data: builtInRecipes };
      case "visual-lab/palettes/list":
        return {
          ok: true,
          data: [...builtInPalettes, ...this.palettes.values()].map(
            (palette) => ({ ...palette, hash: paletteHash(palette) }),
          ),
        };
      case "visual-lab/palette/get": {
        const palette = paletteById(query.id, [...this.palettes.values()]);
        return palette.id === query.id
          ? { ok: true, data: { ...palette, hash: paletteHash(palette) } }
          : { ok: false, message: `Unknown palette: ${query.id}` };
      }
      case "visual-lab/coverage":
        return { ok: true, data: visualLabCoverage() };
      case "visual-lab/diagnostics":
        return { ok: true, data: visualLabDiagnostics(this.values) };
    }
  }
  execute(command: VisualLabCommand): Promise<CommandResult> {
    const result = this.operation.then(
      () => this.executeNow(command),
      () => this.executeNow(command),
    );
    this.operation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  private async executeNow(command: VisualLabCommand): Promise<CommandResult> {
    try {
      this.resultMessage = undefined;
      const exported = await this.apply(command);
      return {
        ok: true,
        data: exported ?? this.state(),
        ...(this.resultMessage ? { message: this.resultMessage } : {}),
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  private async apply(command: VisualLabCommand): Promise<unknown> {
    switch (command.type) {
      case "visual-lab/value/set":
        this.change({
          ...this.values,
          [command.id]: visualRegistry.validate(
            command.id,
            command.value,
            command.clamp,
          ),
        });
        break;
      case "visual-lab/values/patch": {
        const next = { ...this.values };
        for (const [id, value] of Object.entries(command.values))
          next[id] = visualRegistry.validate(id, value, command.clamp);
        this.change(next);
        break;
      }
      case "visual-lab/reset-parameter":
        this.change({
          ...this.values,
          [command.id]: visualRegistry.get(command.id).defaultValue,
        });
        break;
      case "visual-lab/reset-group": {
        const next = { ...this.values };
        for (const item of visualRegistry
          .list()
          .filter((item) => item.group === command.group))
          next[item.id] = item.defaultValue;
        this.change(next);
        break;
      }
      case "visual-lab/reset-all":
        this.change(visualRegistry.defaults());
        this.activeProfile = "HRU Default";
        break;
      case "visual-lab/undo":
        this.undo();
        break;
      case "visual-lab/redo":
        this.redo();
        break;
      case "visual-lab/profile/load":
        this.loadProfile(command.name);
        break;
      case "visual-lab/profile/save":
        this.saveProfile(command.name, command.description);
        break;
      case "visual-lab/profile/duplicate":
        this.duplicate(command.source, command.name);
        break;
      case "visual-lab/profile/rename":
        this.rename(command.source, command.name);
        break;
      case "visual-lab/profile/delete":
        this.delete(command.name);
        break;
      case "visual-lab/profile/export":
        return JSON.stringify(this.requiredProfile(command.name), null, 2);
      case "visual-lab/profile/import":
        this.import(command.json);
        break;
      case "visual-lab/ab/store":
        this.ab = {
          ...this.ab,
          [command.slot]: structuredClone(this.values),
          active: command.slot,
        };
        break;
      case "visual-lab/ab/toggle": {
        const target = this.ab.active === "A" ? "B" : "A";
        if (!this.ab[target]) throw new Error(`A/B slot ${target} is empty`);
        this.change(this.ab[target]!);
        this.ab = { ...this.ab, active: target };
        break;
      }
      case "visual-lab/favorite/toggle":
        visualRegistry.get(command.id);
        this.favorites = this.favorites.includes(command.id)
          ? this.favorites.filter((id) => id !== command.id)
          : [...this.favorites, command.id].sort();
        break;
      case "visual-lab/preference/set":
        this[command.preference] = command.value;
        break;
      case "visual-lab/recipe/apply": {
        const recipe = builtInRecipes.find((item) => item.id === command.id);
        if (!recipe) throw new Error(`Unknown visual recipe: ${command.id}`);
        this.change(applyRecipe(this.values, recipe));
        break;
      }
      case "visual-lab/palette/select": {
        const palette = paletteById(command.id, [...this.palettes.values()]);
        if (palette.id !== command.id)
          throw new Error(`Unknown palette: ${command.id}`);
        const previous = String(this.values["palette.active"]);
        this.paletteWarning = undefined;
        this.change({
          ...this.values,
          "palette.active": command.id,
          "palette.enabled": true,
        });
        this.resultMessage = `palette changed ${previous} → ${command.id}`;
        break;
      }
      case "visual-lab/palette/create": {
        const p = validatePalette(command.palette);
        if (this.paletteExists(p.id))
          throw new Error(`Palette ID “${p.id}” already exists`);
        this.palettes.set(p.id, { ...p, builtIn: false });
        this.resultMessage = `Created palette “${p.name}”`;
        break;
      }
      case "visual-lab/palette/update": {
        const p = validatePalette(command.palette);
        if (p.builtIn || !this.palettes.has(p.id))
          throw new Error("Only existing custom palettes can be updated");
        this.palettes.set(p.id, { ...p, builtIn: false });
        break;
      }
      case "visual-lab/palette/duplicate": {
        const source = paletteById(command.source, [...this.palettes.values()]);
        if (source.id !== command.source) throw new Error("Unknown palette");
        const name = validName(command.name);
        const id = paletteIdFromName(name);
        if (this.paletteExists(id))
          throw new Error(`Palette ID “${id}” already exists`);
        this.palettes.set(id, {
          ...source,
          id,
          name,
          builtIn: false,
          metadata: { createdAt: new Date().toISOString() },
        });
        this.resultMessage = `Duplicated palette as “${name}”`;
        break;
      }
      case "visual-lab/palette/rename": {
        const p = this.palettes.get(command.id);
        if (!p) throw new Error("Built-in palettes cannot be renamed");
        const name = validName(command.name);
        this.palettes.set(command.id, {
          ...p,
          name,
          metadata: { ...p.metadata, updatedAt: new Date().toISOString() },
        });
        break;
      }
      case "visual-lab/palette/delete": {
        if (!this.palettes.delete(command.id))
          throw new Error("Built-in palettes cannot be deleted");
        if (this.values["palette.active"] === command.id)
          this.change({ ...this.values, "palette.active": "hru-default" });
        break;
      }
      case "visual-lab/palette/import": {
        let parsed: unknown;
        try {
          parsed = JSON.parse(command.json);
        } catch {
          throw new Error("Palette import is not valid JSON");
        }
        const palette = validatePalette(parsed as Palette);
        const id = this.uniqueImportedPaletteId(palette.id);
        const conflicted = id !== palette.id;
        const imported = {
          ...palette,
          id,
          name: conflicted ? `${palette.name} (Imported)` : palette.name,
          builtIn: false as const,
          metadata: {
            ...palette.metadata,
            createdAt: new Date().toISOString(),
          },
        };
        this.palettes.set(id, imported);
        this.paletteWarning = undefined;
        this.change({
          ...this.values,
          "palette.active": id,
          "palette.enabled": true,
        });
        this.resultMessage = conflicted
          ? `Imported “${palette.name}” as ${id}; original ID ${palette.id} was already in use`
          : `Imported “${palette.name}”`;
        break;
      }
      case "visual-lab/palette/export": {
        const p = paletteById(command.id, [...this.palettes.values()]);
        if (p.id !== command.id) throw new Error("Unknown palette");
        return JSON.stringify(p, null, 2);
      }
    }
    await this.persist();
    this.emit("change", this.state());
    return undefined;
  }
  private change(values: VisualConfiguration): void {
    this.undoStack = [...this.undoStack, this.values].slice(-HISTORY_LIMIT);
    this.redoStack = [];
    this.values = normalizeVisualConfiguration(values);
  }
  private undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack = [...this.redoStack, this.values].slice(-HISTORY_LIMIT);
    this.values = previous;
  }
  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack = [...this.undoStack, this.values].slice(-HISTORY_LIMIT);
    this.values = next;
  }
  private requiredProfile(name: string): VisualProfile {
    const found = this.profiles.get(name);
    if (!found) throw new Error(`Unknown profile: ${name}`);
    return found;
  }
  private paletteExists(id: string): boolean {
    return (
      this.palettes.has(id) ||
      builtInPalettes.some((palette) => palette.id === id)
    );
  }
  private uniqueImportedPaletteId(id: string): string {
    if (!this.paletteExists(id)) return id;
    const base = `${id.slice(0, 91).replace(/-+$/, "")}-imported`;
    if (!this.paletteExists(base)) return base;
    for (let suffix = 2; suffix < 10_000; suffix += 1) {
      const candidate = `${base.slice(0, 99 - String(suffix).length)}-${suffix}`;
      if (!this.paletteExists(candidate)) return candidate;
    }
    throw new Error(`Could not allocate an imported ID for palette “${id}”`);
  }
  private loadProfile(name: string): void {
    const profile = this.requiredProfile(name);
    const paletteId = String(profile.values["palette.active"]);
    const exists =
      builtInPalettes.some((p) => p.id === paletteId) ||
      this.palettes.has(paletteId);
    this.change(
      exists
        ? profile.values
        : { ...profile.values, "palette.active": "hru-default" },
    );
    this.activeProfile = profile.name;
    this.paletteWarning = exists
      ? undefined
      : `Visual profile references missing palette ${paletteId}; using hru-default`;
  }
  private saveProfile(name: string, description?: string): void {
    name = validName(name);
    if (profileByName(name))
      throw new Error("Built-in profiles cannot be overwritten");
    const now = new Date().toISOString();
    const existing = this.profiles.get(name);
    this.profiles.set(name, {
      formatVersion: 1,
      name,
      schemaVersion: VISUAL_SCHEMA_VERSION,
      values: this.values,
      builtIn: false,
      ...(description ? { description } : {}),
      metadata: {
        createdAt: existing?.metadata?.createdAt ?? now,
        updatedAt: now,
      },
    });
    this.activeProfile = name;
  }
  private duplicate(source: string, name: string): void {
    const original = this.requiredProfile(source);
    name = validName(name);
    if (this.profiles.has(name)) throw new Error("Profile already exists");
    this.profiles.set(name, {
      ...original,
      name,
      builtIn: false,
      metadata: { createdAt: new Date().toISOString() },
    });
  }
  private rename(source: string, name: string): void {
    const profile = this.requiredProfile(source);
    if (profile.builtIn) throw new Error("Built-in profiles cannot be renamed");
    name = validName(name);
    if (this.profiles.has(name)) throw new Error("Profile already exists");
    this.profiles.delete(source);
    this.profiles.set(name, { ...profile, name });
    if (this.activeProfile === source) this.activeProfile = name;
  }
  private delete(name: string): void {
    const profile = this.requiredProfile(name);
    if (profile.builtIn) throw new Error("Built-in profiles cannot be deleted");
    this.profiles.delete(name);
    if (this.activeProfile === name) this.loadProfile("High Visibility");
  }
  private import(json: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("Profile import is not valid JSON");
    }
    if (typeof parsed !== "object" || !parsed)
      throw new Error("Malformed visual profile");
    const profile = parsed as VisualProfile;
    if (
      profile.formatVersion !== 1 ||
      profile.schemaVersion !== VISUAL_SCHEMA_VERSION ||
      typeof profile.name !== "string" ||
      typeof profile.builtIn !== "boolean"
    )
      throw new Error("Incompatible or malformed visual profile");
    if (
      !profile.values ||
      Object.keys(profile.values).length !== visualRegistry.list().length
    )
      throw new Error(
        "Imported profile must contain every registered value exactly once",
      );
    const originalName = validName(profile.name);
    let name = originalName;
    if (this.profiles.has(name) || profileByName(name)) {
      const base = `${originalName.slice(0, 69).trim()} (Imported)`;
      name = base;
      for (
        let suffix = 2;
        this.profiles.has(name) || profileByName(name);
        suffix += 1
      )
        name = `${base.slice(0, 77 - String(suffix).length)} ${suffix}`;
    }
    this.profiles.set(name, {
      ...profile,
      name,
      values: normalizeVisualConfiguration(profile.values),
      builtIn: false,
    });
    this.loadProfile(name);
    this.resultMessage =
      name === originalName
        ? `Imported profile “${name}”`
        : `Imported profile “${originalName}” as “${name}”`;
  }
  private async persist(): Promise<void> {
    await this.persistence.save({
      values: this.values,
      activeProfile: this.activeProfile,
      profiles: [...this.profiles.values()].filter(
        (profile) => !profile.builtIn,
      ),
      palettes: [...this.palettes.values()],
      favorites: this.favorites,
      showAdvanced: this.showAdvanced,
      favoritesOnly: this.favoritesOnly,
      ab: this.ab,
    });
  }
}
function paletteIdFromName(name: string): string {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  if (!id) throw new Error("Palette name must contain a letter or number");
  return id;
}
function validatePalette(p: Palette): Palette {
  if (!p || typeof p !== "object")
    throw new Error("Palette import must contain a JSON object");
  if (typeof p.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(p.id))
    throw new Error(
      "Palette ID must be 1–100 lowercase letters, numbers, or hyphens",
    );
  if (
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.trim().length > 100
  )
    throw new Error("Palette name must contain 1–100 characters");
  if (!Array.isArray(p.colors) || p.colors.length < 2 || p.colors.length > 256)
    throw new Error("Palette colors must contain 2–256 swatches");
  const invalidColor = p.colors.findIndex(
    (color) => typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color),
  );
  if (invalidColor >= 0)
    throw new Error(
      `Invalid hexadecimal color at palette.colors[${invalidColor}]`,
    );
  const allowedRoles = new Set<string>(PALETTE_ROLES);
  const roles = Object.fromEntries(
    Object.entries(p.roles ?? {}).map(([role, indexes]) => {
      if (!allowedRoles.has(role))
        throw new Error(
          `Invalid semantic role “${role}” at palette.roles.${role}`,
        );
      if (!Array.isArray(indexes))
        throw new Error(`Expected swatch indexes at palette.roles.${role}`);
      const invalidIndex = indexes.findIndex(
        (index) =>
          !Number.isInteger(index) || index < 0 || index >= p.colors.length,
      );
      if (invalidIndex >= 0)
        throw new Error(
          `Invalid swatch index at palette.roles.${role}[${invalidIndex}]`,
        );
      return [role, [...indexes]];
    }),
  );
  return {
    id: p.id,
    name: p.name.trim(),
    colors: p.colors.map((color) => color.toLowerCase()),
    roles,
    builtIn: false,
    ...(p.metadata ? { metadata: p.metadata } : {}),
  };
}
