import type { UniverseManifest } from './universe-manifest';
import type { DimensionID, HashHex } from '../shared/ids';
import type { Multiplier } from '../interface/protocol';

export const ZERO_CONTEXT_HEX = '0'.repeat(64) as HashHex;

export type EntityProvenance =
  | { readonly origin: 'genesis'; readonly createdAtTick: 0; readonly seed: 'seed1' | 'seed2' }
  | { readonly origin: 'injection'; readonly createdAtTick: number; readonly injectionCounter: number }
  | { readonly origin: 'condensation'; readonly createdAtTick: number; readonly parentHashes: readonly HashHex[] };

export interface EntityRecord { readonly hash: HashHex; readonly provenance: EntityProvenance }
export interface BondRecord { readonly low: HashHex; readonly high: HashHex; readonly strength: number }
export interface ContextRecord { readonly entityHash: HashHex; readonly contextHash: HashHex }
export interface ClusterStabilityRecord {
  readonly clusterHash: HashHex;
  readonly memberHashes: readonly HashHex[];
  readonly consecutiveTicks: number;
}
export interface CondensationRecord {
  readonly entityHash: HashHex;
  readonly createdAtTick: number;
  readonly parentHashes: readonly HashHex[];
}

export interface AuthoritativeUniverseState {
  readonly manifest: UniverseManifest;
  readonly tick: number;
  readonly entities: readonly EntityRecord[];
  readonly bonds: readonly BondRecord[];
  readonly contexts: readonly ContextRecord[];
  readonly clusterStability: readonly ClusterStabilityRecord[];
  readonly condensationRecords: readonly CondensationRecord[];
  readonly injectionCounter: number;
  readonly deterministicModuleState: Readonly<Record<string, string>>;
}

export type UniverseSnapshot = Readonly<AuthoritativeUniverseState>;

export interface RuntimeSummary {
  readonly manifest: Pick<UniverseManifest, 'universeId' | 'lawVersion' | 'hashAlgorithm'>;
  readonly tick: number;
  readonly running: boolean;
  readonly requestedMultiplier: Multiplier;
  readonly actualTicksPerSecond: number;
  readonly entityCount: number;
  readonly totalBondCount: number;
  readonly activePositiveBondCount: number;
  readonly activeRepulsionCount: number;
  readonly clusterCount: number;
  readonly largestClusterSize: number;
  readonly condensedEntityCount: number;
  readonly injectedEntityCount: number;
  readonly activeDimension: DimensionID;
  readonly stateDigest: HashHex;
  readonly autosaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  readonly lastAutosaveTick?: number;
}
