import { describe, expect, it } from 'vitest';
import { bytesToHash, canonicalPair, hashToBytes, lengthPrefixedUtf8, parseHashHex, uint64 } from './canonical-encoding';
import { hashUtf8 } from './hash-law';
import { createLawV1Manifest } from './manifest';

describe('canonical encoding and genesis', () => {
  it('matches the SHA-256 genesis hashes', () => {
    const manifest = createLawV1Manifest('metadata');
    expect(manifest.genesisHashes).toEqual([
      'df9ecf4c79e5ad77701cfc88c196632b353149d85810a381f469f8fc05dc1b92',
      '35b0fad16758b58124f39f00d26061704514be4e39c1e03b7b23534afd6081e3',
    ]);
    expect(manifest.genesisHashes).toEqual([hashUtf8('seed1'), hashUtf8('seed2')]);
  });

  it('encodes uint64 and length-prefixed UTF-8 stably and rejects malformed values', () => {
    expect(Buffer.from(uint64(0)).toString('hex')).toBe('0000000000000000');
    expect(Buffer.from(uint64(0x01020304050607n)).toString('hex')).toBe('0001020304050607');
    expect(Buffer.from(lengthPrefixedUtf8('HRU')).toString('hex')).toBe('0000000000000003485255');
    expect(() => uint64(-1)).toThrow(); expect(() => uint64(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => uint64(1n << 64n)).toThrow(); expect(() => parseHashHex('AA')).toThrow();
  });

  it('round-trips raw hashes and canonically orders pairs', () => {
    const low = parseHashHex('00'.repeat(32)); const high = parseHashHex('ff'.repeat(32));
    expect(bytesToHash(hashToBytes(high))).toBe(high);
    expect(canonicalPair(high, low)).toEqual([low, high]);
  });
});
