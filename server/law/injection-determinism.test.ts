import { describe, expect, it } from 'vitest';
import { createGenesisState } from './entities';
import { UniverseEngine } from './engine';
import { injectAtTick } from './injection';
import { createLawV1Manifest } from './manifest';
import { sha256Provider } from './hash-law';
import { stateDigest } from './state-digest';

describe('injection and deterministic replay', () => {
  it('injects exactly on schedule beginning with counter zero and persists the counter', () => {
    const parameters = createLawV1Manifest('metadata').parameters;
    expect(injectAtTick(9_999, 0, parameters, sha256Provider)).toEqual({ nextCounter: 0 });
    const injected = injectAtTick(10_000, 0, parameters, sha256Provider); expect(injected.nextCounter).toBe(1);
    expect(injected.entity?.provenance).toEqual({ origin: 'injection', createdAtTick: 10_000, injectionCounter: 0 });
  });
  it('produces the same digest after a substantial run and independent scheduling chunks', () => {
    const manifest = createLawV1Manifest('metadata'); const first = new UniverseEngine(createGenesisState(manifest)); const second = new UniverseEngine(createGenesisState(manifest));
    first.advance(20_000); for (let index = 0; index < 200; index += 1) second.advance(100);
    expect(stateDigest(first.snapshot())).toBe(stateDigest(second.snapshot())); expect(first.snapshot().injectionCounter).toBe(2);
  }, 30_000);
});
