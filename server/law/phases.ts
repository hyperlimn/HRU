import type { ContextRecord, EntityRecord } from '../../src/core/state';
import type { HashHex } from '../../src/shared/ids';
import { concatBytes, hashToBytes, uint64 } from './canonical-encoding';
import type { HashProvider } from './hash-law';

export interface PhaseResult { readonly entityHash: HashHex; readonly phase: Uint8Array; readonly key: string; readonly valence: number }

export function firstBits(bytes: Uint8Array, count: number): string {
  if (!Number.isInteger(count) || count < 1 || count > bytes.length * 8) throw new RangeError('Bit count is out of range');
  let result = '';
  for (let bit = 0; bit < count; bit += 1) result += ((bytes[Math.floor(bit / 8)]! >> (7 - bit % 8)) & 1).toString();
  return result;
}

export function popcount(bytes: Uint8Array): number {
  let count = 0;
  for (const byte of bytes) { let value = byte; while (value !== 0) { value &= value - 1; count += 1; } }
  return count;
}

export function computePhases(entities: readonly EntityRecord[], contexts: readonly ContextRecord[], tick: number, B: number, Vmax: number, hashes: HashProvider): readonly PhaseResult[] {
  const contextByEntity = new Map(contexts.map((record) => [record.entityHash, record.contextHash]));
  return entities.map((entity) => {
    const context = contextByEntity.get(entity.hash);
    if (!context) throw new Error(`Missing context for entity ${entity.hash}`);
    const phase = hashes.hash(concatBytes(hashToBytes(entity.hash), uint64(tick), hashToBytes(context)));
    if (phase.length !== 32) throw new Error('Hash provider must return 32 bytes');
    return { entityHash: entity.hash, phase, key: firstBits(phase, B), valence: 1 + popcount(phase) % Vmax };
  });
}
