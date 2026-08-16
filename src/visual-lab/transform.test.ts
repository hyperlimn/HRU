import { describe, expect, it } from 'vitest';
import { parseHashHex } from '../../server/law/canonical-encoding';
import type { ObservedEntity } from '../observer/observation-types';
import { transformedEntityVisual } from './transform'; import { profileByName } from './profiles';

describe('selected entity visual explanation', () => {
  it('reports stable base and transformed traits without mutating the observation', () => {
    const entity: ObservedEntity = { hash: parseHashHex('ab'.repeat(32)), provenance: { origin: 'genesis', createdAtTick: 0, seed: 'seed1' }, createdAtTick: 0, contextHash: parseHashHex('00'.repeat(32)) };
    const frozen = Object.freeze(entity); const values = profileByName('High Visibility')!.values;
    expect(transformedEntityVisual(frozen, values)).toEqual(transformedEntityVisual(frozen, { ...values })); expect(frozen.createdAtTick).toBe(0);
  });
});
