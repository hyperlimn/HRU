import type { EntityProvenance } from '../core/state';
import type { HashHex } from '../shared/ids';

export interface RenderTraits {
  readonly baseHue: number; readonly emissiveHue: number; readonly emissiveIntensity: number;
  readonly size: number; readonly geometryVariation: 0 | 1 | 2; readonly orientation: readonly [number, number, number];
  readonly provenance: EntityProvenance['origin']; readonly accentHue: number;
}
const unit = (hash: string, offset: number): number => Number.parseInt(hash.slice(offset, offset + 4), 16) / 0xffff;

export function renderTraits(hash: HashHex, provenance: EntityProvenance, contextHash: HashHex, clustered: boolean): RenderTraits {
  if (!/^[0-9a-f]{64}$/.test(hash) || !/^[0-9a-f]{64}$/.test(contextHash)) throw new TypeError('Render traits require canonical hashes');
  const provenanceScale = provenance.origin === 'genesis' ? 1.45 : provenance.origin === 'condensation' ? 1.3 : 1;
  return Object.freeze({
    baseHue: unit(hash, 0), emissiveHue: unit(hash, 4), emissiveIntensity: 0.18 + unit(hash, 8) * 0.42,
    size: (0.18 + unit(hash, 12) * 0.18) * provenanceScale,
    geometryVariation: Math.floor(unit(hash, 16) * 3) as 0 | 1 | 2,
    orientation: [unit(hash, 20) * Math.PI * 2, unit(hash, 24) * Math.PI * 2, unit(hash, 28) * Math.PI * 2] as const,
    provenance: provenance.origin, accentHue: clustered ? unit(contextHash, 0) : unit(hash, 32),
  });
}
