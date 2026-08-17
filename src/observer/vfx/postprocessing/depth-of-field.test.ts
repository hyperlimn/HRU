import {describe,expect,it} from 'vitest';
import {visualRegistry,normalizeVisualConfiguration} from '../../../visual-lab/registry';

describe('camera-owned Depth of Field',()=>{
 it('registers DOF under Camera rather than the VFX category',()=>{expect(visualRegistry.get('camera.dof.enabled').category).toBe('Camera');expect(visualRegistry.get('camera.dof.enabled').subcategory).toBe('Depth of Field');expect(()=>visualRegistry.get('vfx.dof.status')).toThrow()});
 it('validates focus modes and preserves manual focus values',()=>{const values=normalizeVisualConfiguration({...visualRegistry.defaults(),'camera.dof.enabled':true,'camera.dof.focusMode':'Manual distance','camera.dof.focusDistance':42});expect(values['camera.dof.focusDistance']).toBe(42);expect(values['camera.dof.focusMode']).toBe('Manual distance')});
 it('keeps camera controls as shared Visual Lab values',()=>{const values=visualRegistry.defaults();expect(values['camera.showViewportControls']).toBe(true);expect(values['camera.autoRotateSpeed']).toBe(2)});
});
