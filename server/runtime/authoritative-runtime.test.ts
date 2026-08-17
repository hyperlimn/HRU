import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SaveListing } from '../../src/modules/saves/save-system';
import { UniverseEngine } from '../law/engine';
import { createGenesisState } from '../law/entities';
import { createLawV1Manifest } from '../law/manifest';
import { stateDigest } from '../law/state-digest';
import { AuthoritativeRuntime } from './authoritative-runtime';
import { SimulationWorkerHost } from './simulation-worker-host';
import { VisualLabService } from '../visual-lab/service';
import { resolveEffectiveVisualObject, selectionForEntity } from '../../src/observer/visual-object';
import type { Palette } from '../../src/visual-lab/palettes';
import type { ObservationFrame } from '../../src/observer/observation-types';

describe('worker-owned save continuation', () => {
  it('save/restart/resume matches uninterrupted execution exactly', async () => {
    const path = await mkdtemp(join(tmpdir(), 'hru-runtime-test-')); const manifest = createLawV1Manifest('2026-01-01T00:00:00.000Z');
    const worker1 = new SimulationWorkerHost(); const initial1 = await worker1.start(createGenesisState(manifest)); const runtime1 = new AuthoritativeRuntime(worker1, initial1, manifest, path);
    try {
      const at100 = new UniverseEngine(createGenesisState(manifest)).advance(100); await worker1.replaceState(at100);
      const result = await runtime1.command({ type: 'saves/save-current', label: 'Continuation' }); const listing = result.data as SaveListing;
      const saved = (await runtime1.saves.list()).find((item) => item.id === listing.id)!;
      const uninterrupted = new UniverseEngine(saved.state).advance(200);
      await worker1.stop();
      const worker2 = new SimulationWorkerHost(); const initial2 = await worker2.start(createGenesisState({ ...manifest, createdAt: '2027-01-01T00:00:00.000Z' })); const runtime2 = new AuthoritativeRuntime(worker2, initial2, manifest, path);
      try { expect((await runtime2.command({ type: 'saves/resume', snapshotId: saved.id })).ok).toBe(true); const resumed = new UniverseEngine(await worker2.getState()).advance(200); expect(stateDigest(resumed)).toBe(stateDigest(uninterrupted)); }
      finally { runtime2.stop(); await worker2.stop(); }
    } finally { runtime1.stop(); await worker1.stop().catch(() => undefined); await rm(path, { recursive: true, force: true }); }
  }, 30_000);
});

describe('machine visual causality queries',()=>{
  it('returns the same effective-state structure used by the human inspector',async()=>{const path=await mkdtemp(join(tmpdir(),'hru-visual-query-')),manifest=createLawV1Manifest('2026-01-01T00:00:00.000Z'),worker=new SimulationWorkerHost(),initial=await worker.start(createGenesisState(manifest)),visual=await VisualLabService.create(join(path,'visual.json')),runtime=new AuthoritativeRuntime(worker,initial,manifest,join(path,'saves'),visual);try{await visual.execute({type:'visual-lab/palette/select',id:'aurora'});const frame=(await runtime.query({type:'observation/frame'})).data as ObservationFrame,selection=selectionForEntity(frame.entities[0]!),effective=await runtime.query({type:'visual-object/effective-state',selection}),why=await runtime.query({type:'visual-object/why',selection}),coverage=await runtime.query({type:'visual-lab/coverage'}),palettes=visual.query({type:'visual-lab/palettes/list'}).data as readonly Palette[],local=resolveEffectiveVisualObject(frame,selection,visual.state().values,{palettes});expect(effective).toEqual({ok:true,data:local});expect((effective.data as {palette:{activePaletteId:string}}).palette.activePaletteId).toBe('aurora');expect((why.data as unknown[]).length).toBeGreaterThan(0);expect(coverage.ok).toBe(true);expect(coverage.data as unknown[]).toHaveLength(437);expect((await runtime.query({type:'visual-object/inspect',selection:{type:'cluster',sourceIdentity:'0'.repeat(64),sourceType:'Cluster'}})).ok).toBe(false)}finally{runtime.stop();await worker.stop();await rm(path,{recursive:true,force:true})}},30_000);
});
