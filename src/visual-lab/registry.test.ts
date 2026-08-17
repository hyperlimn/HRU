import { describe, expect, it } from 'vitest';
import { VISUAL_SCHEMA_VERSION, normalizeVisualConfiguration, visualRegistry } from './registry';
import { builtInProfiles } from './profiles';

describe('VisualParameterRegistry', () => {
  it('has unique IDs and valid defaults', () => {
    const ids = visualRegistry.list().map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(() => normalizeVisualConfiguration(visualRegistry.defaults())).not.toThrow();
  });
  it('permits creative typed values but rejects technically invalid values', () => {
    expect(() => visualRegistry.validate('scene.exposure', Number.NaN)).toThrow();
    expect(() => visualRegistry.validate('scene.exposure', Infinity)).toThrow();
    expect(visualRegistry.validate('scene.exposure', 99)).toBe(99);
    expect(() => visualRegistry.validate('scene.background', 'red')).toThrow();
    expect(() => visualRegistry.validate('scene.toneMapping', 'cinematic')).toThrow();
    expect(() => visualRegistry.validate('unknown.setting', 1)).toThrow();
    expect(() => visualRegistry.validate('camera.fov', 180)).toThrow();
    expect(() => visualRegistry.validate('scene.gridDivisions', 2.5)).toThrow();
    expect(() => normalizeVisualConfiguration({ ...visualRegistry.defaults(), 'camera.near': 50, 'camera.far': 40 })).toThrow(/Nearest/);
    expect(() => normalizeVisualConfiguration({ ...visualRegistry.defaults(), 'vfx.routing.1.inputMin': 1, 'vfx.routing.1.inputMax': 1 })).toThrow(/range cannot be zero/);
  });
  it('gives every parameter a reachable sidebar category and human-facing label',()=>{for(const parameter of visualRegistry.list()){expect(parameter.category.length).toBeGreaterThan(0);expect(parameter.categoryOrder).toBeGreaterThan(0);expect(parameter.label).not.toBe(parameter.id);expect(parameter.sliderMin===undefined||parameter.sliderMax===undefined||parameter.sliderMin<=parameter.sliderMax).toBe(true);}expect(new Set(visualRegistry.list().map(({category})=>category))).toEqual(new Set(['Three.js World','Grid','Camera','Lighting','Entities','Relationships','Clusters','Contexts','Selection','Events / Persistence','Deterministic VFX','Performance / Observation','Color Palette']));});
  it('places every relationship parameter under one category with useful nested sections',()=>{
    const relationships=visualRegistry.list().filter(({id})=>id.startsWith('relationship.'));
    expect(relationships.length).toBeGreaterThan(0);
    expect(relationships.every(({category})=>category==='Relationships')).toBe(true);
    expect(new Set(relationships.map(({subcategory})=>subcategory))).toEqual(new Set(['Positive / Active Bonds','Weak / Developing Bonds','Repulsion','Shared Relationship Geometry','Temporal / Pulse Behavior']));
  });
  it('ships immutable complete built-ins with the current schema', () => {
    expect(builtInProfiles.map(({ name }) => name)).toEqual(['HRU Default', 'High Visibility', 'Deep Field', 'Diagnostic']);
    for (const profile of builtInProfiles) { expect(profile.builtIn).toBe(true); expect(profile.schemaVersion).toBe(VISUAL_SCHEMA_VERSION); expect(Object.keys(profile.values)).toHaveLength(visualRegistry.list().length); }
  });
});
