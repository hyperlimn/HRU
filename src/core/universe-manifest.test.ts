import { describe, expect, it } from 'vitest';
import { deterministicManifest } from './universe-manifest';
import { createLawV1Manifest } from '../../server/law/manifest';

describe('deterministicManifest', () => {
  it('explicitly excludes creation timestamp metadata', () => {
    expect(deterministicManifest(createLawV1Manifest('metadata'))).not.toHaveProperty('createdAt');
  });
});
