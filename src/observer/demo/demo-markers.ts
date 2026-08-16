import * as THREE from 'three';
import { stableDemoValue } from '../../core/hash';

/** Development-only observer markers. These are not authoritative state or HRU entities. */
export function createDemoMarkers(count = 72): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DEVELOPMENT_MARKERS_NOT_HRU_ENTITIES';
  const geometry = new THREE.IcosahedronGeometry(0.09, 1);
  for (let index = 0; index < count; index += 1) {
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.52 + stableDemoValue(index, 9) * 0.18, 0.7, 0.55), emissive: 0x061420 });
    const marker = new THREE.Mesh(geometry, material);
    const radius = 2 + stableDemoValue(index, 31) * 4;
    const angle = index * 2.399963;
    marker.position.set(Math.cos(angle) * radius, (stableDemoValue(index, 71) - 0.5) * 5, Math.sin(angle) * radius);
    marker.scale.setScalar(0.6 + stableDemoValue(index, 101) * 1.8);
    group.add(marker);
  }
  return group;
}
