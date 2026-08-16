import type { BondRecord, ContextRecord } from '../../src/core/state';
import type { LawParameters } from '../../src/core/universe-manifest';
import type { HashHex } from '../../src/shared/ids';
import { bondKey, canonicalPair, compareHashes, concatBytes, hashToBytes, uint64 } from './canonical-encoding';
import type { CandidatePair } from './candidates';
import type { HashProvider } from './hash-law';
import type { PhaseResult } from './phases';

export function pairAffinity(first: HashHex, second: HashHex, phases: readonly PhaseResult[], contexts: readonly ContextRecord[], tick: number, hashes: HashProvider): number {
  const [low, high] = canonicalPair(first, second);
  const phaseMap = new Map(phases.map((phase) => [phase.entityHash, phase.phase]));
  const contextMap = new Map(contexts.map((context) => [context.entityHash, context.contextHash]));
  const phaseLow = phaseMap.get(low); const phaseHigh = phaseMap.get(high); const contextLow = contextMap.get(low); const contextHigh = contextMap.get(high);
  if (!phaseLow || !phaseHigh || !contextLow || !contextHigh) throw new Error('Affinity inputs are incomplete');
  const x = hashes.hash(concatBytes(phaseLow, phaseHigh, uint64(tick), hashToBytes(contextLow), hashToBytes(contextHigh)));
  return 2 * (x[0]! / 255) - 1;
}

export function isActivePositive(strength: number, parameters: LawParameters): boolean { return strength > parameters.thetaBond; }
export function isActiveRepulsion(strength: number, parameters: LawParameters): boolean { return strength < parameters.thetaRepel; }
export function clampStrength(value: number): number { return Math.max(-1, Math.min(1, value)); }

export function updateBonds(candidates: readonly CandidatePair[], existing: readonly BondRecord[], phases: readonly PhaseResult[], contexts: readonly ContextRecord[], tick: number, parameters: LawParameters, hashes: HashProvider): readonly BondRecord[] {
  const bonds = new Map<string, BondRecord>();
  for (const bond of existing) { const [low, high] = canonicalPair(bond.low, bond.high); bonds.set(bondKey(low, high), { low, high, strength: bond.strength }); }
  const valence = new Map(phases.map((phase) => [phase.entityHash, phase.valence]));
  const activeDegree = (entity: HashHex): number => [...bonds.values()].filter((bond) => (bond.low === entity || bond.high === entity) && isActivePositive(bond.strength, parameters)).length;
  for (const [low, high] of candidates) {
    const key = bondKey(low, high); const bond = bonds.get(key);
    const affinity = pairAffinity(low, high, phases, contexts, tick, hashes);
    if (bond) {
      const strength = clampStrength(bond.strength + parameters.alpha * (affinity - bond.strength));
      if (Math.abs(strength) < parameters.thetaDissolve) bonds.delete(key);
      else bonds.set(key, { low, high, strength });
    } else if (affinity > parameters.thetaAffinity && activeDegree(low) < valence.get(low)! && activeDegree(high) < valence.get(high)!) {
      bonds.set(key, { low, high, strength: parameters.epsilon });
    } else if (affinity < -parameters.thetaAffinity) bonds.set(key, { low, high, strength: -parameters.epsilon });
  }
  return [...bonds.values()].sort((a, b) => compareHashes(a.low, b.low) || compareHashes(a.high, b.high));
}
