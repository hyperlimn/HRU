import { describe, expect, it } from 'vitest';
import { parseHashHex } from '../../server/law/canonical-encoding';
import type { ObservedEntity } from '../observer/observation-types';
import { entityGeometryDetail, transformedEntityVisual } from './transform'; import { profileByName } from './profiles';

describe('selected entity visual explanation', () => {
  it('reports stable base and transformed traits without mutating the observation', () => {
    const entity: ObservedEntity = { hash: parseHashHex('ab'.repeat(32)), provenance: { origin: 'genesis', createdAtTick: 0, seed: 'seed1' }, createdAtTick: 0, contextHash: parseHashHex('00'.repeat(32)) };
    const frozen = Object.freeze(entity); const values = profileByName('High Visibility')!.values;
    expect(transformedEntityVisual(frozen, values)).toEqual(transformedEntityVisual(frozen, { ...values })); expect(frozen.createdAtTick).toBe(0);
  });
});

describe('hash-derived entity smoothness',()=>{it('is reproducible and distributes different hashes across the configured range',()=>{const values=profileByName('High Visibility')!.values;const make=(hash:string):ObservedEntity=>({hash:parseHashHex(hash),provenance:{origin:'genesis',createdAtTick:0,seed:'seed1'},createdAtTick:0,contextHash:parseHashHex('00'.repeat(32))});const faceted=make(`${'ab'.repeat(18)}00000000${'cd'.repeat(10)}`),smooth=make(`${'ab'.repeat(18)}ffffffff${'cd'.repeat(10)}`);expect(entityGeometryDetail(faceted,values)).not.toBe(entityGeometryDetail(smooth,values));expect(entityGeometryDetail(faceted,values)).toBe(entityGeometryDetail(structuredClone(faceted),{...values}));});});
