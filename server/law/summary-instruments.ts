import type { AuthoritativeUniverseState, RuntimeSummary } from '../../src/core/state';
import type { DimensionID } from '../../src/shared/ids';
import type { Multiplier } from '../../src/interface/protocol';
import { isActivePositive, isActiveRepulsion } from './bonds';
import { detectClusters } from './clusters';
import { sha256Provider } from './hash-law';
import { stateDigest } from './state-digest';

export interface RuntimeTelemetry {
  readonly running: boolean; readonly requestedMultiplier: Multiplier; readonly actualTicksPerSecond: number;
  readonly activeDimension: DimensionID; readonly autosaveStatus: RuntimeSummary['autosaveStatus']; readonly lastAutosaveTick?: number;
}

export function summarize(state: AuthoritativeUniverseState, telemetry: RuntimeTelemetry): RuntimeSummary {
  const parameters = state.manifest.parameters;
  const clusters = detectClusters(state.entities, state.bonds, parameters, sha256Provider);
  return {
    manifest: { universeId: state.manifest.universeId, lawVersion: state.manifest.lawVersion, hashAlgorithm: state.manifest.hashAlgorithm },
    tick: state.tick, running: telemetry.running, requestedMultiplier: telemetry.requestedMultiplier,
    actualTicksPerSecond: telemetry.actualTicksPerSecond, entityCount: state.entities.length, totalBondCount: state.bonds.length,
    activePositiveBondCount: state.bonds.filter((bond) => isActivePositive(bond.strength, parameters)).length,
    activeRepulsionCount: state.bonds.filter((bond) => isActiveRepulsion(bond.strength, parameters)).length,
    clusterCount: clusters.length, largestClusterSize: Math.max(0, ...clusters.map((cluster) => cluster.memberHashes.length)),
    condensedEntityCount: state.condensationRecords.length,
    injectedEntityCount: state.entities.filter((entity) => entity.provenance.origin === 'injection').length,
    activeDimension: telemetry.activeDimension, stateDigest: stateDigest(state), autosaveStatus: telemetry.autosaveStatus,
    ...(telemetry.lastAutosaveTick === undefined ? {} : { lastAutosaveTick: telemetry.lastAutosaveTick }),
  };
}
