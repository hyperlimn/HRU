import { describe, expect, it } from 'vitest';
import { ZERO_CONTEXT_HEX, type EntityRecord } from '../../src/core/state';
import { DEFAULT_LAW_PARAMETERS } from '../../src/core/universe-manifest';
import { parseHashHex } from './canonical-encoding';
import { detectClusters, type Cluster } from './clusters';
import { applyCondensation } from './condensation';
import { nextContexts } from './contexts';
import type { HashProvider } from './hash-law';

const a = parseHashHex('11'.repeat(32)); const b = parseHashHex('22'.repeat(32)); const c = parseHashHex('33'.repeat(32)); const clusterHash = parseHashHex('aa'.repeat(32));
const entities: EntityRecord[] = [a, b, c].map((hash, index) => ({ hash, provenance: { origin: 'genesis', createdAtTick: 0, seed: index === 0 ? 'seed1' : 'seed2' } }));
const hashProvider: HashProvider = { hash: () => new Uint8Array(32).fill(0xaa) };

describe('clusters, contexts, and condensation', () => {
  it('uses only active positive bonds and updates clustered/free contexts', () => {
    const clusters = detectClusters(entities, [{ low: a, high: b, strength: 0.61 }, { low: b, high: c, strength: 0.6 }, { low: a, high: c, strength: -0.9 }], DEFAULT_LAW_PARAMETERS, hashProvider);
    expect(clusters).toEqual([{ clusterHash, memberHashes: [a, b] }]);
    expect(nextContexts(entities, clusters)).toEqual([{ entityHash: a, contextHash: clusterHash }, { entityHash: b, contextHash: clusterHash }, { entityHash: c, contextHash: ZERO_CONTEXT_HEX }]);
  });
  it('condenses an identical membership on tick five exactly once and retains provenance after dissolution', () => {
    const cluster: Cluster = { clusterHash, memberHashes: [a, b] }; let stability = [] as ReturnType<typeof applyCondensation>['stability']; let records = [] as ReturnType<typeof applyCondensation>['records']; let all = entities;
    for (let tick = 1; tick <= 5; tick += 1) { const result = applyCondensation([cluster], stability, all, records, tick, DEFAULT_LAW_PARAMETERS); stability = result.stability; records = result.records; all = [...all, ...result.newEntities]; }
    expect(records).toEqual([{ entityHash: clusterHash, createdAtTick: 5, parentHashes: [a, b] }]);
    expect(all.find((entity) => entity.hash === clusterHash)?.provenance).toEqual({ origin: 'condensation', createdAtTick: 5, parentHashes: [a, b] });
    const sixth = applyCondensation([cluster], stability, all, records, 6, DEFAULT_LAW_PARAMETERS); expect(sixth.newEntities).toEqual([]); expect(sixth.records).toHaveLength(1);
    const dissolved = applyCondensation([], sixth.stability, all, sixth.records, 7, DEFAULT_LAW_PARAMETERS); expect(dissolved.records).toEqual(records); expect(all.some((entity) => entity.hash === clusterHash)).toBe(true);
  });
});
