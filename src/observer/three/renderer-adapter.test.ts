import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { parseHashHex } from '../../../server/law/canonical-encoding';
import { renderChannels } from '../render-channels';
import { InstanceSelectionMap, applyChannelVisibility } from './renderer-adapter';

describe('renderer adapter boundaries',()=>{
  it('applies render-channel state to scene groups',()=>{const groups=Object.fromEntries(renderChannels.map((channel)=>[channel.id,new THREE.Group()])) as unknown as Parameters<typeof applyChannelVisibility>[0];const channels=Object.fromEntries(renderChannels.map((channel)=>[channel.id,channel.id==='entities'])) as Parameters<typeof applyChannelVisibility>[1];applyChannelVisibility(groups,channels);expect(groups.entities.visible).toBe(true);expect(groups['positive-bonds'].visible).toBe(false);});
  it('maps an instanced selection to the correct entity',()=>{const map=new InstanceSelectionMap();const mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(),new THREE.MeshBasicMaterial(),2);const hash=parseHashHex('ab'.repeat(32));map.set(mesh,1,hash);expect(map.get(mesh,1)).toBe(hash);expect(map.get(mesh,0)).toBeUndefined();});
});
