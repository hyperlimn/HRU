import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { profileByName } from '../../src/visual-lab/profiles';
import { visualRegistry } from '../../src/visual-lab/registry';
import { visualProfileHash } from './profile-hash'; import { VisualLabService } from './service';
import { createGenesisState } from '../law/entities'; import { createLawV1Manifest } from '../law/manifest'; import { stateDigest } from '../law/state-digest';

describe('Visual Lab profiles and service', () => {
  it('normalizes profile identity canonically and excludes timestamps', () => {
    const profile = profileByName('High Visibility')!; const reversed = Object.fromEntries(Object.entries(profile.values).reverse());
    expect(visualProfileHash(profile)).toBe(visualProfileHash({ ...profile, values: reversed, metadata: { createdAt: '2099-01-01T00:00:00Z' } }));
  });
  it('persists separately, defaults to High Visibility, and supports bounded undo/reset/A-B', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hru-visual-')); const file = join(root, 'observer', 'visual-lab.json');
    try {
      const service = await VisualLabService.create(file); expect(service.state().activeProfile).toBe('High Visibility');
      const before = service.state().values['entity.scale']; await service.execute({ type: 'visual-lab/value/set', id: 'entity.scale', value: 3 }); await service.execute({ type: 'visual-lab/ab/store', slot: 'A' }); await service.execute({ type: 'visual-lab/value/set', id: 'entity.scale', value: 4 }); await service.execute({ type: 'visual-lab/ab/store', slot: 'B' });
      expect(service.state().ab.differingParameters).toContain('entity.scale'); await service.execute({ type: 'visual-lab/ab/toggle' }); expect(service.state().values['entity.scale']).toBe(3);
      await service.execute({ type: 'visual-lab/reset-parameter', id: 'entity.scale' }); expect(service.state().values['entity.scale']).toBe(visualRegistry.get('entity.scale').defaultValue); await service.execute({ type: 'visual-lab/undo' }); expect(service.state().values['entity.scale']).toBe(3);
      const restarted = await VisualLabService.create(file); expect(restarted.state().values['entity.scale']).toBe(3); expect(await readFile(file, 'utf8')).toContain('hru-visual-1'); expect(file).not.toContain('saves'); expect(before).not.toBeUndefined();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('protects built-ins and rejects malformed imports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hru-visual-'));
    try { const service = await VisualLabService.create(join(root, 'visual.json')); expect((await service.execute({ type: 'visual-lab/profile/delete', name: 'HRU Default' })).ok).toBe(false); expect((await service.execute({ type: 'visual-lab/profile/save', name: 'Diagnostic' })).ok).toBe(false); expect((await service.execute({ type: 'visual-lab/profile/import', json: '{bad' })).ok).toBe(false); expect((await service.execute({ type: 'visual-lab/profile/import', json: JSON.stringify({ formatVersion: 99 }) })).ok).toBe(false); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
  it('cannot alter authoritative Law v1 identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hru-visual-')); const universe = createGenesisState(createLawV1Manifest('2026-01-01T00:00:00.000Z')); const before = stateDigest(universe);
    try { const service = await VisualLabService.create(join(root, 'visual.json')); await service.execute({ type: 'visual-lab/values/patch', values: { 'entity.scale': 8, 'scene.exposure': 4, 'relationship.eventDuration': 10 } }); expect(stateDigest(universe)).toBe(before); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
  it('serializes concurrent commands so memory and atomic persistence cannot diverge', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hru-visual-'));
    const file = join(root, 'visual.json');
    try {
      const service = await VisualLabService.create(file);
      const results = await Promise.all([
        service.execute({ type: 'visual-lab/value/set', id: 'entity.scale', value: 2.5 }),
        service.execute({ type: 'visual-lab/value/set', id: 'entity.brightness', value: 1.75 }),
      ]);
      expect(results.every(({ ok }) => ok)).toBe(true);
      const restarted = await VisualLabService.create(file);
      expect(restarted.state().values['entity.scale']).toBe(2.5);
      expect(restarted.state().values['entity.brightness']).toBe(1.75);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('recovers safely from corrupt observer settings and exposes the reason', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hru-visual-'));
    const file = join(root, 'visual.json');
    try {
      await writeFile(file, '{broken', 'utf8');
      const service = await VisualLabService.create(file);
      expect(service.state().activeProfile).toBe('High Visibility');
      expect(service.state().paletteWarning).toContain('settings are invalid');
      expect((await service.execute({ type: 'visual-lab/value/set', id: 'entity.scale', value: 2 })).ok).toBe(true);
      expect((await VisualLabService.create(file)).state().values['entity.scale']).toBe(2);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
