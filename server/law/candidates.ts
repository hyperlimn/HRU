import type { BondRecord } from '../../src/core/state';
import type { HashHex } from '../../src/shared/ids';
import { bondKey, canonicalPair, compareCanonicalStrings, compareHashes } from './canonical-encoding';
import type { PhaseResult } from './phases';

export type CandidatePair = readonly [HashHex, HashHex];

export function generateCandidates(phases: readonly PhaseResult[], bonds: readonly BondRecord[]): readonly CandidatePair[] {
  const pairs = new Map<string, CandidatePair>();
  for (const bond of [...bonds].sort((a, b) => compareCanonicalStrings(bondKey(a.low, a.high), bondKey(b.low, b.high)))) {
    const pair = canonicalPair(bond.low, bond.high); pairs.set(bondKey(...pair), pair);
  }
  const buckets = new Map<string, HashHex[]>();
  for (const phase of [...phases].sort((a, b) => compareHashes(a.entityHash, b.entityHash))) {
    const bucket = buckets.get(phase.key) ?? []; bucket.push(phase.entityHash); buckets.set(phase.key, bucket);
  }
  for (const key of [...buckets.keys()].sort()) {
    const members = buckets.get(key)!.sort(compareHashes);
    for (let left = 0; left < members.length; left += 1) for (let right = left + 1; right < members.length; right += 1) {
      const pair = [members[left]!, members[right]!] as const; pairs.set(bondKey(...pair), pair);
    }
  }
  return [...pairs.values()].sort((a, b) => compareHashes(a[0], b[0]) || compareHashes(a[1], b[1]));
}
