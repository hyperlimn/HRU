/** Stable non-cryptographic helper for demo presentation only; simulation hashes come later. */
export function stableDemoValue(index: number, salt: number): number {
  let value = (index + 1) * 0x9e3779b1 ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0xffffffff;
}
