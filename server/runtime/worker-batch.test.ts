import { describe, expect, it } from 'vitest';
import { UniverseEngine } from '../law/engine';
import { createGenesisState } from '../law/entities';
import { createLawV1Manifest } from '../law/manifest';
import { advanceWorkerBatch } from './worker-batch';

describe('worker autosave boundaries', () => {
  it('captures the exact 100,000 boundary when a batch crosses it', () => {
    const initial = { ...createGenesisState(createLawV1Manifest('metadata')), tick: 99_995 };
    const engine = new UniverseEngine(initial); const boundaries: number[] = [];
    advanceWorkerBatch(engine, 10, (state) => boundaries.push(state.tick));
    expect(boundaries).toEqual([100_000]); expect(engine.snapshot().tick).toBe(100_005);
  });
});
