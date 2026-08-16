import type { UniverseID } from '../shared/ids';

export interface UniverseManifest {
  readonly universeId: UniverseID;
  readonly genesisHashes: readonly string[];
  readonly hashAlgorithm: string;
  readonly lawVersion: string;
  readonly parameters: Readonly<Record<string, string | number | boolean>>;
  readonly enabledDeterministicModules: readonly string[];
  /** Metadata only. Explicitly excluded from state evolution and deterministic identity. */
  readonly createdAt: string;
}

export type DeterministicManifest = Omit<UniverseManifest, 'createdAt'>;

export function deterministicManifest(manifest: UniverseManifest): DeterministicManifest {
  const { createdAt: _metadataOnly, ...deterministic } = manifest;
  return deterministic;
}
