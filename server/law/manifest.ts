import { DEFAULT_LAW_PARAMETERS, LAW_V1_MODULES, type UniverseManifest } from '../../src/core/universe-manifest';
import { DEFAULT_UNIVERSE_ID } from '../../src/shared/ids';
import { hashUtf8 } from './hash-law';

export function createLawV1Manifest(createdAt = new Date().toISOString()): UniverseManifest {
  return {
    universeId: DEFAULT_UNIVERSE_ID,
    genesisHashes: [hashUtf8('seed1'), hashUtf8('seed2')],
    hashAlgorithm: 'sha256', lawVersion: 'hru-law-1', parameters: DEFAULT_LAW_PARAMETERS,
    enabledDeterministicModules: LAW_V1_MODULES, createdAt,
  };
}
