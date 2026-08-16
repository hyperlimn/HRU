import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { parseHashHex } from '../../../server/law/canonical-encoding';
import { renderChannels } from '../render-channels';
import { InstanceSelectionMap, ThreeObservationRenderer, applyChannelVisibility } from './renderer-adapter';
import { visualRegistry } from '../../visual-lab/registry';

describe('renderer adapter boundaries',()=>{
  it('applies render-channel state to scene groups',()=>{const groups=Object.fromEntries(renderChannels.map((channel)=>[channel.id,new THREE.Group()])) as unknown as Parameters<typeof applyChannelVisibility>[0];const channels=Object.fromEntries(renderChannels.map((channel)=>[channel.id,channel.id==='entities'])) as Parameters<typeof applyChannelVisibility>[1];applyChannelVisibility(groups,channels);expect(groups.entities.visible).toBe(true);expect(groups['positive-bonds'].visible).toBe(false);});
  it('maps an instanced selection to the correct entity',()=>{const map=new InstanceSelectionMap();const mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(),new THREE.MeshBasicMaterial(),2);const hash=parseHashHex('ab'.repeat(32));map.set(mesh,1,hash);expect(map.get(mesh,1)).toBe(hash);expect(map.get(mesh,0)).toBeUndefined();});
  it('applies material settings without geometry rebuild and rebuilds only for geometry detail',()=>{const adapter=new ThreeObservationRenderer(new THREE.Scene());const base=visualRegistry.defaults();expect(adapter.setVisualConfiguration({...base,'scene.exposure':2}).geometryRebuilt).toBe(false);const revision=adapter.debugGeometryRevision();expect(adapter.setVisualConfiguration({...base,'entity.geometryDetail':2}).geometryRebuilt).toBe(true);expect(adapter.debugGeometryRevision()).toBe(revision+1);adapter.dispose();});
  it('reconstructs grid resources in place without accumulating scene objects',()=>{const scene=new THREE.Scene();const adapter=new ThreeObservationRenderer(scene);const base=visualRegistry.defaults();for(let size=31;size<41;size+=1)adapter.setVisualConfiguration({...base,'scene.gridSize':size});expect(scene.getObjectByName('observation:dimension-effects')?.children).toHaveLength(1);expect(scene.children.filter((child)=>child.name.startsWith('observation:'))).toHaveLength(renderChannels.length);adapter.dispose();expect(scene.children.filter((child)=>child.name.startsWith('observation:'))).toHaveLength(0);});
});
