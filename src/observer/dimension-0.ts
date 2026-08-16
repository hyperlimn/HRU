import type { HashHex } from '../shared/ids';

export interface Position3 { readonly x: number; readonly y: number; readonly z: number }
const HASH = /^[0-9a-f]{64}$/;
const component = (hash: string, offset: number): number => (Number.parseInt(hash.slice(offset, offset + 8), 16) / 0xffffffff * 2 - 1) * 12;

/** Pure observer projection. Coordinates never enter authoritative state. */
export function dimensionZeroPosition(hash: HashHex): Position3 {
  if (!HASH.test(hash)) throw new TypeError('Dimension-0 placement requires a canonical SHA-256 hash');
  return Object.freeze({ x: component(hash, 0), y: component(hash, 8), z: component(hash, 16) });
}
