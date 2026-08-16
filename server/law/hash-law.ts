import { createHash } from 'node:crypto';
import type { HashHex } from '../../src/shared/ids';
import { bytesToHash, utf8 } from './canonical-encoding';

export interface HashProvider { hash(input: Uint8Array): Uint8Array }

export const sha256Provider: HashProvider = Object.freeze({
  hash(input: Uint8Array): Uint8Array { return new Uint8Array(createHash('sha256').update(input).digest()); },
});

export function sha256(input: Uint8Array): Uint8Array { return sha256Provider.hash(input); }
export function sha256Hex(input: Uint8Array): HashHex { return bytesToHash(sha256(input)); }
export function hashUtf8(value: string): HashHex { return sha256Hex(utf8(value)); }
