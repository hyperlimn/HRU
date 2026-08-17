import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { parseHashHex } from '../../../../server/law/canonical-encoding';
import type { ObservationFrame } from '../../observation-types';
import { normalizeVisualConfiguration, visualRegistry } from '../../../visual-lab/registry';
import { resolveDofFocusDistance } from './bloom-controller';

describe('camera-owned Depth of Field',()=>{
 it('registers DOF under Camera rather than the VFX category',()=>{expect(visualRegistry.get('camera.dof.enabled').category).toBe('Camera');expect(visualRegistry.get('camera.dof.enabled').subcategory).toBe('Depth of Field');expect(()=>visualRegistry.get('vfx.dof.status')).toThrow()});
 it('validates focus modes and preserves manual focus values',()=>{const values=normalizeVisualConfiguration({...visualRegistry.defaults(),'camera.dof.enabled':true,'camera.dof.focusMode':'Manual distance','camera.dof.focusDistance':42});expect(values['camera.dof.focusDistance']).toBe(42);expect(values['camera.dof.focusMode']).toBe('Manual distance')});
 it('keeps camera controls as shared Visual Lab values',()=>{const values=visualRegistry.defaults();expect(values['camera.showViewportControls']).toBe(true);expect(values['camera.autoRotateSpeed']).toBe(2)});
 it('consumes the canonical selected-cluster mode and rendered world transform',()=>{
  const first=parseHashHex('11'.repeat(32)),second=parseHashHex('22'.repeat(32)),zero=parseHashHex('00'.repeat(32)),clusterHash=parseHashHex('33'.repeat(32));
  const frame:ObservationFrame={tick:0,stateDigest:parseHashHex('44'.repeat(32)),entities:[{hash:first,provenance:{origin:'genesis',createdAtTick:0,seed:'seed1'},createdAtTick:0,contextHash:zero,clusterHash},{hash:second,provenance:{origin:'genesis',createdAtTick:0,seed:'seed2'},createdAtTick:0,contextHash:zero,clusterHash}],bonds:[],clusters:[{clusterHash,memberHashes:[first,second]}],condensationRecords:[]};
  const values=normalizeVisualConfiguration({...visualRegistry.defaults(),'camera.dof.focusMode':"Selected Entity's cluster",'scene.originOffset':[5,0,0]});
  expect(resolveDofFocusDistance(frame,first,values,new THREE.Vector3())).not.toBe(values['camera.dof.focusDistance']);
 });
});
