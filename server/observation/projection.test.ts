import { describe, expect, it } from 'vitest';
import { createGenesisState } from '../law/entities';
import { createLawV1Manifest } from '../law/manifest';
import { projectObservationFrame } from './projection';

describe('observation projection', () => {
  it('is canonical and cannot mutate authoritative state', () => {
    const state = createGenesisState(createLawV1Manifest('metadata')); const reversed = { ...state, entities: [...state.entities].reverse(), contexts: [...state.contexts].reverse() };
    const frame = projectObservationFrame(reversed); expect(frame.entities.map((entity) => entity.hash)).toEqual([...state.entities].map((entity) => entity.hash).sort());
    const original = structuredClone(state); (frame.entities[0] as { contextHash: string }).contextHash = 'f'.repeat(64);
    expect(state).toEqual(original); expect(projectObservationFrame(state).stateDigest).toBe(projectObservationFrame(reversed).stateDigest);
  });
});
