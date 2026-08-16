import { describe, expect, it } from 'vitest';
import type { BondRecord, ContextRecord } from '../../src/core/state';
import { ZERO_CONTEXT_HEX } from '../../src/core/state';
import { DEFAULT_LAW_PARAMETERS } from '../../src/core/universe-manifest';
import type { HashHex } from '../../src/shared/ids';
import { bondKey, parseHashHex } from './canonical-encoding';
import { pairAffinity, updateBonds } from './bonds';
import { generateCandidates } from './candidates';
import type { HashProvider } from './hash-law';
import { sha256Provider } from './hash-law';
import type { PhaseResult } from './phases';

const a = parseHashHex('11'.repeat(32)); const b = parseHashHex('22'.repeat(32)); const c = parseHashHex('33'.repeat(32));
const contexts: ContextRecord[] = [a, b, c].map((entityHash) => ({ entityHash, contextHash: ZERO_CONTEXT_HEX }));
const phases: PhaseResult[] = [
  { entityHash: a, phase: Uint8Array.from({ length: 32 }, () => 1), key: 'same', valence: 2 },
  { entityHash: b, phase: Uint8Array.from({ length: 32 }, () => 2), key: 'same', valence: 2 },
  { entityHash: c, phase: Uint8Array.from({ length: 32 }, () => 3), key: 'other', valence: 2 },
];
const provider = (firstByte: number): HashProvider => ({ hash: () => Uint8Array.of(firstByte, ...new Array<number>(31).fill(0)) });

describe('candidate and bond laws', () => {
  it('makes pair order irrelevant to affinity and bond identity', () => {
    expect(pairAffinity(a, b, phases, contexts, 7, sha256Provider)).toBe(pairAffinity(b, a, phases, contexts, 7, sha256Provider));
    expect(bondKey(a, b)).toBe(bondKey(b, a));
  });
  it('generates deterministic deduplicated collision and existing-bond candidates', () => {
    const bonds: BondRecord[] = [{ low: a, high: b, strength: 0.2 }, { low: b, high: c, strength: -0.2 }];
    expect(generateCandidates([...phases].reverse(), [...bonds].reverse())).toEqual([[a, b], [b, c]]);
  });
  it('creates, updates, clamps, and dissolves exactly by rule', () => {
    const pair = [[a, b] as const];
    expect(updateBonds(pair, [], phases, contexts, 1, DEFAULT_LAW_PARAMETERS, provider(255))[0]?.strength).toBe(0.3);
    expect(updateBonds(pair, [], phases, contexts, 1, DEFAULT_LAW_PARAMETERS, provider(0))[0]?.strength).toBe(-0.3);
    const existing = [{ low: a, high: b, strength: 0.5 }];
    expect(updateBonds(pair, existing, phases, contexts, 1, DEFAULT_LAW_PARAMETERS, provider(255))[0]?.strength).toBeCloseTo(0.575);
    expect(updateBonds(pair, [{ low: a, high: b, strength: 0.9 }], phases, contexts, 1, { ...DEFAULT_LAW_PARAMETERS, alpha: 2 }, provider(255))[0]?.strength).toBe(1);
    expect(updateBonds(pair, [{ low: a, high: b, strength: 0.01 }], phases, contexts, 1, { ...DEFAULT_LAW_PARAMETERS, alpha: 0.5 }, provider(128))).toEqual([]);
  });
});
