import type { HashHex } from '../../src/shared/ids';

const MAX_UINT64 = (1n << 64n) - 1n;
const HEX_256 = /^[0-9a-f]{64}$/;

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export function uint64(value: number | bigint): Uint8Array {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) throw new RangeError('uint64 requires a non-negative safe integer');
  const integer = BigInt(value);
  if (integer < 0n || integer > MAX_UINT64) throw new RangeError('uint64 value is out of range');
  const bytes = new Uint8Array(8); let remaining = integer;
  for (let index = 7; index >= 0; index -= 1) { bytes[index] = Number(remaining & 0xffn); remaining >>= 8n; }
  return bytes;
}

export function float64(value: number): Uint8Array {
  if (!Number.isFinite(value)) throw new RangeError('float64 requires a finite number');
  const bytes = new Uint8Array(8); new DataView(bytes.buffer).setFloat64(0, value, false); return bytes;
}

export function utf8(value: string): Uint8Array { return new TextEncoder().encode(value); }

export function lengthPrefixedUtf8(value: string): Uint8Array {
  const bytes = utf8(value);
  return concatBytes(uint64(bytes.length), bytes);
}

export function parseHashHex(value: string): HashHex {
  if (!HEX_256.test(value)) throw new TypeError('Hash must be exactly 64 lowercase hexadecimal characters');
  return value as HashHex;
}

export function hashToBytes(value: string): Uint8Array {
  parseHashHex(value); const bytes = new Uint8Array(32);
  for (let index = 0; index < 32; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

export function bytesToHash(bytes: Uint8Array): HashHex {
  if (bytes.length !== 32) throw new TypeError('SHA-256 hash must contain exactly 32 bytes');
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('') as HashHex;
}

export function compareHashes(left: HashHex, right: HashHex): number { return left < right ? -1 : left > right ? 1 : 0; }
export function compareCanonicalStrings(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }

export function canonicalPair(first: HashHex, second: HashHex): readonly [HashHex, HashHex] {
  if (first === second) throw new Error('Entity pair requires two distinct hashes');
  return compareHashes(first, second) < 0 ? [first, second] : [second, first];
}

export function bondKey(first: HashHex, second: HashHex): string {
  const [low, high] = canonicalPair(first, second); return `${low}:${high}`;
}

export function sortedHashes(values: Iterable<HashHex>): HashHex[] { return [...values].sort(compareHashes); }

/**
 * Law v1 hash-input layouts (all concatenation has no implicit delimiter):
 * phase: hash[32] | tick:uint64be[8] | context[32]
 * affinity: phaseLow[32] | phaseHigh[32] | tick:uint64be[8] | contextLow[32] | contextHigh[32]
 * cluster: sorted member hashes, each raw[32]
 * injection: outsideSeedLength:uint64be[8] | outsideSeed:utf8[n] | tick:uint64be[8] | counter:uint64be[8]
 * variable strings elsewhere: byteLength:uint64be[8] | UTF-8 bytes.
 */
