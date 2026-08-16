import type { HashHex, UniverseID } from '../shared/ids';

export interface LawParameters {
  readonly B: number;
  readonly Vmax: number;
  readonly alpha: number;
  readonly epsilon: number;
  readonly thetaAffinity: number;
  readonly thetaBond: number;
  readonly thetaRepel: number;
  readonly thetaDissolve: number;
  readonly condensationTicks: number;
  readonly injectionInterval: number;
  readonly outsideSeed: string;
}

export interface UniverseManifest {
  readonly universeId: UniverseID;
  readonly genesisHashes: readonly HashHex[];
  readonly hashAlgorithm: 'sha256';
  readonly lawVersion: 'hru-law-1';
  readonly parameters: LawParameters;
  readonly enabledDeterministicModules: readonly string[];
  /** Metadata only: excluded from engine decisions and state digests. */
  readonly createdAt: string;
}

export type DeterministicManifest = Omit<UniverseManifest, 'createdAt'>;

export const DEFAULT_LAW_PARAMETERS: LawParameters = Object.freeze({
  B: 8, Vmax: 8, alpha: 0.15, epsilon: 0.3,
  thetaAffinity: 0.4, thetaBond: 0.6, thetaRepel: -0.6, thetaDissolve: 0.05,
  condensationTicks: 5, injectionInterval: 10_000, outsideSeed: 'hru-outside-0',
});

export const LAW_V1_MODULES = [
  'entities', 'phases', 'candidates', 'bonds', 'clusters', 'contexts', 'condensation', 'injection',
] as const;

export function deterministicManifest(manifest: UniverseManifest): DeterministicManifest {
  const { createdAt: _metadataOnly, ...deterministic } = manifest;
  return deterministic;
}
