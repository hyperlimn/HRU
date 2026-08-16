import { describe, expect, it } from 'vitest';
import { createGenesisState } from './entities';
import { createLawV1Manifest } from './manifest';
import { stateDigest } from './state-digest';

describe('canonical state digest', () => {
  it('ignores construction order and creation timestamp metadata', () => {
    const state = createGenesisState(createLawV1Manifest('2026-01-01T00:00:00.000Z'));
    const shuffled = { ...state, manifest: { ...state.manifest, createdAt: '2030-01-01T00:00:00.000Z' }, entities: [...state.entities].reverse(), contexts: [...state.contexts].reverse() };
    expect(stateDigest(shuffled)).toBe(stateDigest(state));
  });
});
