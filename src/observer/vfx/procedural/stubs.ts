import type {VfxModuleDefinition} from '../shared/types';
const postprocessing=[{capability:'postprocessing' as const,reason:'WebGL postprocessing is unavailable'}];
export const preparedVfxModules:readonly VfxModuleDefinition[]=[
 {id:'linked-particles',label:'Linked Particles',status:'unavailable',requirements:[{capability:'compute',reason:'native WebGPU compute required'}],targets:['Relationships'],intendedParameters:['Particle budget','Link budget'],performance:'high'},
];
