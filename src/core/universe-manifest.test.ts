import { describe, expect, it } from 'vitest';
import { deterministicManifest } from './universe-manifest';
import { DEFAULT_UNIVERSE_ID } from '../shared/ids';

describe('deterministicManifest', () => {
  it('explicitly excludes creation timestamp metadata', () => {
    const result = deterministicManifest({ universeId: DEFAULT_UNIVERSE_ID, genesisHashes: ['a'], hashAlgorithm: 'x', lawVersion: '0', parameters: {}, enabledDeterministicModules: [], createdAt: 'never hashed' });
    expect(result).not.toHaveProperty('createdAt');
  });
});
