import type { RendererCapabilities,VfxRequirement } from '../shared/types';

export function detectRendererCapabilities(renderer?:{capabilities?:{isWebGL2?:boolean}}):RendererCapabilities{
  const webgl=Boolean(renderer); const nativeWebgpu=typeof navigator!=='undefined'&&'gpu' in navigator;
  return Object.freeze({backend:webgl?'webgl':'unknown',webgl,webgpu:false,nativeWebgpu,tsl:false,postprocessing:webgl,mrt:Boolean(renderer?.capabilities?.isWebGL2),compute:false});
}
export function unmetRequirement(capabilities:RendererCapabilities,requirements:readonly VfxRequirement[]):string|undefined{
  return requirements.find((requirement)=>!capabilities[requirement.capability])?.reason;
}
