import { describe,expect,it } from 'vitest';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { visualRegistry } from '../visual-lab/registry';
import { applyOrbitConfiguration } from './SceneObserver';

describe('viewport auto orbit',()=>{it('updates the existing OrbitControls configuration and stops immediately when disabled',()=>{const controls={enableDamping:false,dampingFactor:0,rotateSpeed:0,panSpeed:0,zoomSpeed:0,autoRotate:false,autoRotateSpeed:0} as Pick<OrbitControls,'enableDamping'|'dampingFactor'|'rotateSpeed'|'panSpeed'|'zoomSpeed'|'autoRotate'|'autoRotateSpeed'>;const values=visualRegistry.defaults();applyOrbitConfiguration(controls,{...values,'camera.autoRotate':true,'camera.autoRotateSpeed':7});expect(controls.autoRotate).toBe(true);expect(controls.autoRotateSpeed).toBe(7);applyOrbitConfiguration(controls,{...values,'camera.autoRotate':false});expect(controls.autoRotate).toBe(false);});});
