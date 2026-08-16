import { VISUAL_SCHEMA_VERSION,normalizeVisualConfiguration,visualRegistry } from './registry';
import type { VisualConfiguration,VisualProfile } from './types';
const profile=(name:string,description:string,patch:Record<string,number|string|boolean>):VisualProfile=>({formatVersion:1,name,schemaVersion:VISUAL_SCHEMA_VERSION,description,builtIn:true,values:normalizeVisualConfiguration({...visualRegistry.defaults(),...patch})});
export const builtInProfiles:readonly VisualProfile[]=[
profile('HRU Default','Original Observation Module appearance.',{'light.fillEnabled':false}),
profile('High Visibility','Bright, larger entities and persistent relationship activity.',{'scene.exposure':1.55,'entity.scale':2.25,'entity.brightness':1.5,'entity.lightness':.68,'entity.emissiveMultiplier':2.2,'light.ambientIntensity':2.2,'relationship.weakOpacity':.5,'relationship.activeOpacity':.95,'relationship.eventBrightness':1.6,'relationship.eventScale':3,'relationship.eventDuration':3.5,'relationship.ghostDuration':3.5,'cluster.opacity':.24}),
profile('Deep Field','Restrained luminous dark-space observation.',{'scene.background':'#02040a','scene.fogColor':'#02040a','scene.fogDensity':.04,'scene.exposure':.8,'entity.scale':1.2,'entity.lightness':.48,'entity.emissiveMultiplier':1.8,'scene.gridOpacity':.25,'light.ambientIntensity':.7}),
profile('Diagnostic','Maximum classification clarity and debugging guides.',{'scene.background':'#000000','scene.fogEnabled':false,'scene.exposure':1.8,'entity.scale':2,'entity.saturation':1,'entity.lightness':.72,'relationship.positiveColor':'#00e5ff','relationship.negativeColor':'#ff006e','relationship.weakOpacity':.75,'relationship.activeOpacity':1,'relationship.activeThickness':2,'scene.gridOpacity':1,'context.opacity':.8,'cluster.opacity':.4}),
];
export function profileByName(name:string):VisualProfile|undefined{return builtInProfiles.find((profile)=>profile.name===name)}
export function configurationsDiffer(a?:VisualConfiguration,b?:VisualConfiguration):string[]{if(!a||!b)return[];return visualRegistry.list().map((item)=>item.id).filter((id)=>JSON.stringify(a[id])!==JSON.stringify(b[id]));}
