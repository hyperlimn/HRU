import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { Palette } from '../../src/visual-lab/palettes';
import { normalizeVisualConfiguration, VISUAL_SCHEMA_VERSION, visualRegistry } from '../../src/visual-lab/registry';
import type { VisualConfiguration, VisualProfile } from '../../src/visual-lab/types';
import { migrateLegacyPaletteSelection } from './migrations';

const value = z.union([
  z.number().finite(),
  z.boolean(),
  z.string(),
  z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
]);
const profile = z.object({
  formatVersion: z.literal(1),
  name: z.string().min(1).max(80),
  schemaVersion: z.literal(VISUAL_SCHEMA_VERSION),
  values: z.record(z.string(), value),
  description: z.string().max(500).optional(),
  builtIn: z.literal(false),
  metadata: z.object({ createdAt: z.string().optional(), updatedAt: z.string().optional() }).optional(),
}).strict();
const palette = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(2).max(256),
  roles: z.record(z.string(), z.array(z.number().int().nonnegative())).optional(),
  builtIn: z.literal(false),
  metadata: z.object({ createdAt: z.string().optional(), updatedAt: z.string().optional() }).optional(),
}).strict();
const fileSchema = z.object({
  formatVersion: z.literal(1),
  schemaVersion: z.literal(VISUAL_SCHEMA_VERSION),
  values: z.record(z.string(), value),
  activeProfile: z.string(),
  profiles: z.array(profile),
  palettes: z.array(palette).default([]),
  favorites: z.array(z.string()),
  showAdvanced: z.boolean(),
  favoritesOnly: z.boolean(),
  ab: z.object({
    active: z.enum(['A', 'B']).optional(),
    A: z.record(z.string(), value).optional(),
    B: z.record(z.string(), value).optional(),
  }).strict(),
}).strict();

export interface PersistedVisualLab {
  values: VisualConfiguration;
  activeProfile: string;
  profiles: VisualProfile[];
  palettes: Palette[];
  favorites: string[];
  showAdvanced: boolean;
  favoritesOnly: boolean;
  ab: { active?: 'A' | 'B'; A?: VisualConfiguration; B?: VisualConfiguration };
}

export class VisualLabPersistence {
  warning?: string;

  constructor(private readonly path: string) {}

  async load(): Promise<PersistedVisualLab | undefined> {
    this.warning = undefined;
    let raw: string;
    try {
      raw = await readFile(this.path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      this.warning = `Visual Lab settings could not be read; using built-ins (${error instanceof Error ? error.message : String(error)})`;
      return undefined;
    }

    try {
      const parsed = fileSchema.parse(JSON.parse(raw));
      for (const id of parsed.favorites) visualRegistry.get(id);
      const migrated = migrateLegacyPaletteSelection(parsed.values);
      if (migrated.warning) this.warning = migrated.warning;
      const normalize = (values: VisualConfiguration) => normalizeVisualConfiguration(migrateLegacyPaletteSelection(values).values);
      return {
        ...parsed,
        values: normalizeVisualConfiguration(migrated.values),
        profiles: parsed.profiles.map((item) => ({ ...item, values: normalize(item.values) })),
        ab: {
          ...parsed.ab,
          ...(parsed.ab.A ? { A: normalize(parsed.ab.A) } : {}),
          ...(parsed.ab.B ? { B: normalize(parsed.ab.B) } : {}),
        },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
      this.warning = `Visual Lab settings are invalid; using built-ins (${reason})`;
      return undefined;
    }
  }

  async save(data: PersistedVisualLab): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const payload = { formatVersion: 1, schemaVersion: VISUAL_SCHEMA_VERSION, ...data };
    fileSchema.parse(payload);
    const temporary = `${this.path}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      await rename(temporary, this.path);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
