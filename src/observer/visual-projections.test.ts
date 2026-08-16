import { describe, expect, it } from 'vitest';
import { parseHashHex } from '../../server/law/canonical-encoding';
import { ZERO_CONTEXT_HEX } from '../core/state';
import { dimensionZeroPosition } from './dimension-0';
import { renderTraits } from './render-traits';

describe('observer visual projections', () => {
  const first = parseHashHex('12'.repeat(32)); const second = parseHashHex('ab'.repeat(32));
  const provenance = { origin: 'genesis', createdAtTick: 0, seed: 'seed1' } as const;
  it('maps hashes to stable bounded Dimension-0 positions', () => {
    expect(dimensionZeroPosition(first)).toEqual(dimensionZeroPosition(first));
    expect(dimensionZeroPosition(first)).not.toEqual(dimensionZeroPosition(second));
    expect(Object.values(dimensionZeroPosition(first)).every((value) => value >= -12 && value <= 12)).toBe(true);
  });
  it('derives stable render traits without mutable output', () => {
    const traits = renderTraits(first, provenance, ZERO_CONTEXT_HEX, false);
    expect(traits).toEqual(renderTraits(first, provenance, ZERO_CONTEXT_HEX, false)); expect(Object.isFrozen(traits)).toBe(true);
    expect(traits).not.toEqual(renderTraits(second, provenance, ZERO_CONTEXT_HEX, false));
  });
});
