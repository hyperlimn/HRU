import type {VisualConfiguration,VisualValue} from './types';
export interface VisualRecipe {readonly id:string;readonly name:string;readonly description:string;readonly values:Readonly<Record<string,VisualValue>>;readonly includesPalette?:boolean;readonly builtIn:true}
export const builtInRecipes:readonly VisualRecipe[]=[
 {id:'entity-aura',name:'Entity Aura',description:'A restrained particle aura around entities.',builtIn:true,values:{'vfx.particleField.enabled':true,'vfx.particleField.target':'Entities','vfx.particleField.particlesPerTarget':96,'vfx.particleField.brightness':1.4}},
 {id:'bond-flow',name:'Bond Flow',description:'Particle and vortex expression along relationships.',builtIn:true,values:{'vfx.particleField.enabled':true,'vfx.particleField.target':'Relationships','vfx.vortexField.enabled':true,'vfx.vortexField.target':'Relationships'}},
 {id:'cluster-halo',name:'Cluster Halo',description:'A luminous field around active clusters.',builtIn:true,values:{'vfx.particleField.enabled':true,'vfx.particleField.target':'Clusters','vfx.vortexField.enabled':true,'vfx.vortexField.target':'Clusters'}},
 {id:'event-shockwave',name:'Event Shockwave',description:'Tick-driven distortion around recent events.',builtIn:true,values:{'vfx.radialBlur.enabled':true,'vfx.radialBlur.trigger.positiveCreated':true,'vfx.radialBlur.trigger.bondDissolved':true,'vfx.radialBlur.trigger.condensation':true}},
 {id:'relational-glow',name:'Relational Glow',description:'Selective bloom driven by relationship strength.',builtIn:true,values:{'vfx.selective.enabled':true,'vfx.selective.target':'Relationships','vfx.routing.1.driver':'Absolute Bond Strength','vfx.routing.1.weight':1}},
 {id:'deep-field',name:'Deep Field',description:'Restrained luminous dark-space observation.',builtIn:true,values:{'scene.fogEnabled':true,'scene.exposure':.8,'vfx.bloom.enabled':true,'vfx.bloom.strength':.7,'camera.dof.enabled':true,'camera.dof.focusMode':'Largest visible cluster'}},
];
export function applyRecipe(values:VisualConfiguration,recipe:VisualRecipe):VisualConfiguration{return {...values,...recipe.values};}
