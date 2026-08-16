import * as THREE from 'three';
import type { ObservedEntity } from '../observer/observation-types';
import { dimensionZeroPosition } from '../observer/dimension-0';
import { renderTraits } from '../observer/render-traits';
import type { VisualConfiguration } from './types';
import { numberValue } from './configuration';

export function transformedEntityVisual(entity: ObservedEntity, values: VisualConfiguration) {
  const base = renderTraits(entity.hash, entity.provenance, entity.contextHash, Boolean(entity.clusterHash));
  const intrinsicProvenance = entity.provenance.origin === 'genesis' ? 1.45 : entity.provenance.origin === 'condensation' ? 1.3 : 1;
  const configuredProvenance = entity.provenance.origin === 'genesis' ? numberValue(values, 'entity.genesisMultiplier') : entity.provenance.origin === 'injection' ? numberValue(values, 'entity.injectionMultiplier') : numberValue(values, 'entity.condensationMultiplier');
  const provenanceMultiplier = configuredProvenance / intrinsicProvenance;
  const traitMin = numberValue(values, 'entity.minTraitScale'); const traitMax = numberValue(values, 'entity.maxTraitScale');
  const normalizedBase = Math.max(traitMin, Math.min(traitMax, base.size / intrinsicProvenance)) * intrinsicProvenance;
  const size = normalizedBase * numberValue(values, 'entity.scale') * provenanceMultiplier;
  const saturation = numberValue(values, 'entity.saturation'); const lightness = numberValue(values, 'entity.lightness') * numberValue(values, 'entity.brightness');
  const baseColor = new THREE.Color().setHSL(base.baseHue, saturation, lightness);
  const accentStrength = (entity.clusterHash ? numberValue(values, 'entity.clusterAccent') : 0) + (entity.contextHash !== '0'.repeat(64) ? numberValue(values, 'entity.contextAccent') : 0);
  if (accentStrength > 0) baseColor.lerp(new THREE.Color().setHSL(base.accentHue, saturation, lightness), Math.min(1, accentStrength));
  const emissive = base.emissiveIntensity * numberValue(values, 'entity.emissiveMultiplier') * numberValue(values, 'entity.brightness');
  const position = dimensionZeroPosition(entity.hash); const spread = numberValue(values, 'scene.worldSpread');
  return { base, size, finalColor: `#${baseColor.getHexString()}`, emissive, provenanceMultiplier, accentStrength, geometryDetail:entityGeometryDetail(entity,values), position: { x: position.x * spread, y: position.y * spread, z: position.z * spread } };
}

export function entityGeometryDetail(entity: ObservedEntity, values: VisualConfiguration): number {
  const traits=renderTraits(entity.hash,entity.provenance,entity.contextHash,Boolean(entity.clusterHash));
  const minimum=numberValue(values,'entity.minHashSmoothness'),maximum=numberValue(values,'entity.maxHashSmoothness');
  const hashDetail=minimum+(maximum-minimum)*traits.smoothnessUnit;const baseline=numberValue(values,'entity.geometryDetail');
  return Math.max(0,Math.min(5,Math.round(baseline+(hashDetail-baseline)*numberValue(values,'entity.hashSmoothnessStrength'))));
}
