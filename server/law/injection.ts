import type { EntityRecord } from '../../src/core/state';
import type { LawParameters } from '../../src/core/universe-manifest';
import { bytesToHash, concatBytes, lengthPrefixedUtf8, uint64 } from './canonical-encoding';
import type { HashProvider } from './hash-law';

export interface InjectionResult { readonly entity?: EntityRecord; readonly nextCounter: number }

export function injectAtTick(tick: number, counter: number, parameters: LawParameters, hashes: HashProvider): InjectionResult {
  if (tick < parameters.injectionInterval || tick % parameters.injectionInterval !== 0) return { nextCounter: counter };
  const hash = bytesToHash(hashes.hash(concatBytes(lengthPrefixedUtf8(parameters.outsideSeed), uint64(tick), uint64(counter))));
  return { entity: { hash, provenance: { origin: 'injection', createdAtTick: tick, injectionCounter: counter } }, nextCounter: counter + 1 };
}
