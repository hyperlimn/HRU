import type { AuthoritativeUniverseState, EntityProvenance } from '../../src/core/state';
import type { LawParameters } from '../../src/core/universe-manifest';
import type { HashHex } from '../../src/shared/ids';
import { compareCanonicalStrings, compareHashes, concatBytes, float64, hashToBytes, lengthPrefixedUtf8, uint64 } from './canonical-encoding';
import { sha256Hex } from './hash-law';

const oneByte = (value: number): Uint8Array => Uint8Array.of(value);
const hashList = (hashes: readonly HashHex[]): Uint8Array => concatBytes(uint64(hashes.length), ...[...hashes].sort(compareHashes).map(hashToBytes));

function encodeParameters(parameters: LawParameters): Uint8Array {
  return concatBytes(
    uint64(parameters.B), uint64(parameters.Vmax), float64(parameters.alpha), float64(parameters.epsilon),
    float64(parameters.thetaAffinity), float64(parameters.thetaBond), float64(parameters.thetaRepel), float64(parameters.thetaDissolve),
    uint64(parameters.condensationTicks), uint64(parameters.injectionInterval), lengthPrefixedUtf8(parameters.outsideSeed),
  );
}

function encodeProvenance(provenance: EntityProvenance): Uint8Array {
  switch (provenance.origin) {
    case 'genesis': return concatBytes(oneByte(0), uint64(0), lengthPrefixedUtf8(provenance.seed));
    case 'injection': return concatBytes(oneByte(1), uint64(provenance.createdAtTick), uint64(provenance.injectionCounter));
    case 'condensation': return concatBytes(oneByte(2), uint64(provenance.createdAtTick), hashList(provenance.parentHashes));
  }
}

/**
 * State digest v1 byte layout:
 * lp("HRU_STATE_V1") | lp(universeId) | lp(hashAlgorithm) | lp(lawVersion) |
 * genesisHashCount:u64 + sorted raw hashes | encoded fixed-order LawParameters |
 * enabledModuleCount:u64 + sorted lp(module) | tick:u64 |
 * entityCount:u64 + [hash[32] | provenanceTag:u8 | provenancePayload]* sorted by hash |
 * bondCount:u64 + [low[32] | high[32] | strength:f64be]* sorted by pair |
 * contextCount:u64 + [entity[32] | context[32]]* sorted by entity |
 * stabilityCount:u64 + [cluster[32] | memberHashList | consecutive:u64]* sorted by cluster |
 * condensationCount:u64 + [entity[32] | createdTick:u64 | parentHashList]* sorted by entity |
 * injectionCounter:u64 | moduleStateCount:u64 + [lp(key) | lp(value)]* sorted by key.
 * Manifest createdAt and all runtime/observer controls are deliberately absent.
 */
export function serializeCanonicalState(state: AuthoritativeUniverseState): Uint8Array {
  const manifest = state.manifest;
  const entities = [...state.entities].sort((a, b) => compareHashes(a.hash, b.hash));
  const bonds = [...state.bonds].sort((a, b) => compareHashes(a.low, b.low) || compareHashes(a.high, b.high));
  const contexts = [...state.contexts].sort((a, b) => compareHashes(a.entityHash, b.entityHash));
  const stability = [...state.clusterStability].sort((a, b) => compareHashes(a.clusterHash, b.clusterHash));
  const condensations = [...state.condensationRecords].sort((a, b) => compareHashes(a.entityHash, b.entityHash));
  const modules = Object.entries(state.deterministicModuleState).sort(([a], [b]) => compareCanonicalStrings(a, b));
  return concatBytes(
    lengthPrefixedUtf8('HRU_STATE_V1'), lengthPrefixedUtf8(manifest.universeId), lengthPrefixedUtf8(manifest.hashAlgorithm), lengthPrefixedUtf8(manifest.lawVersion),
    hashList(manifest.genesisHashes), encodeParameters(manifest.parameters),
    uint64(manifest.enabledDeterministicModules.length), ...[...manifest.enabledDeterministicModules].sort().map(lengthPrefixedUtf8),
    uint64(state.tick), uint64(entities.length), ...entities.map((entity) => concatBytes(hashToBytes(entity.hash), encodeProvenance(entity.provenance))),
    uint64(bonds.length), ...bonds.map((bond) => concatBytes(hashToBytes(bond.low), hashToBytes(bond.high), float64(bond.strength))),
    uint64(contexts.length), ...contexts.map((context) => concatBytes(hashToBytes(context.entityHash), hashToBytes(context.contextHash))),
    uint64(stability.length), ...stability.map((record) => concatBytes(hashToBytes(record.clusterHash), hashList(record.memberHashes), uint64(record.consecutiveTicks))),
    uint64(condensations.length), ...condensations.map((record) => concatBytes(hashToBytes(record.entityHash), uint64(record.createdAtTick), hashList(record.parentHashes))),
    uint64(state.injectionCounter), uint64(modules.length), ...modules.map(([key, value]) => concatBytes(lengthPrefixedUtf8(key), lengthPrefixedUtf8(value))),
  );
}

export function stateDigest(state: AuthoritativeUniverseState): HashHex { return sha256Hex(serializeCanonicalState(state)); }
