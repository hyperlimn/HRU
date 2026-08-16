import { describe, expect, it } from 'vitest';
import type { AuthoritativeUniverseState, BondRecord, EntityRecord } from '../../src/core/state';
import { ZERO_CONTEXT_HEX } from '../../src/core/state';
import { parseHashHex } from '../law/canonical-encoding';
import { createGenesisState } from '../law/entities';
import { createLawV1Manifest } from '../law/manifest';
import { deriveObservationEvents } from './events';

const manifest = createLawV1Manifest('metadata'); const base = createGenesisState(manifest); const [a,b] = base.entities.map((entity) => entity.hash);
const state = (tick: number, bonds: readonly BondRecord[], entities: readonly EntityRecord[] = base.entities): AuthoritativeUniverseState => ({ ...base, tick, bonds, entities, contexts: entities.map((entity) => ({ entityHash: entity.hash, contextHash: ZERO_CONTEXT_HEX })) });

describe('deterministic observation events', () => {
  it('emits canonical stable creation, dissolution, and threshold events', () => {
    const created = deriveObservationEvents(state(0, []), state(1, [{ low: a!, high: b!, strength: 0.3 }]));
    expect(created.map((event) => event.type)).toEqual(['positive-bond-created']); expect(created[0]!.strength).toBe(0.3);
    expect(deriveObservationEvents(state(0, []), state(1, [{ low: a!, high: b!, strength: -0.3 }]))[0]!.type).toBe('negative-bond-created');
    expect(deriveObservationEvents(state(0, [{ low:a!,high:b!,strength:0.01 }]), state(1, []))[0]!.type).toBe('bond-dissolved');
    const active = deriveObservationEvents(state(0, [{low:a!,high:b!,strength:.59}]), state(1, [{low:a!,high:b!,strength:.61}]));
    expect(active.map((event) => event.type)).toEqual(['bond-became-active-positive','cluster-formed']);
    expect(deriveObservationEvents(state(0, [{low:a!,high:b!,strength:.61}]), state(1, [{low:a!,high:b!,strength:.59}])).map((event)=>event.type)).toEqual(['bond-left-active-positive','cluster-dissolved']);
    expect(deriveObservationEvents(state(0, [{low:a!,high:b!,strength:-.59}]), state(1, [{low:a!,high:b!,strength:-.61}]))[0]!.type).toBe('bond-became-active-repulsion');
    expect(deriveObservationEvents(state(0, [{low:a!,high:b!,strength:-.61}]), state(1, [{low:a!,high:b!,strength:-.59}]))[0]!.type).toBe('bond-left-active-repulsion');
    expect(created).toEqual(deriveObservationEvents(state(0, []), state(1, [{ low: a!, high: b!, strength: 0.3 }])));
  });
  it('emits injection and condensation entities canonically', () => {
    const injectionHash=parseHashHex('cc'.repeat(32)); const condensedHash=parseHashHex('dd'.repeat(32));
    const additions: EntityRecord[]=[{hash:condensedHash,provenance:{origin:'condensation',createdAtTick:1,parentHashes:[a!,b!]}},{hash:injectionHash,provenance:{origin:'injection',createdAtTick:1,injectionCounter:0}}];
    expect(deriveObservationEvents(state(0, []), state(1, [], [...base.entities,...additions])).map((event)=>event.type)).toEqual(['entity-injected','entity-condensed']);
  });
});
