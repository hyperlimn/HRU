export type VfxDriverId='Manual'|'Entity Hash'|'Context Hash'|'Pair Hash'|'Bond Strength'|'Absolute Bond Strength'|'Bond Age'|'Cluster Size'|'Cluster Age'|'Cluster Stability'|'Event Age'|'Event Type'|'Dimension';
export interface VfxDriverContext {readonly manual?:number;readonly entityHash?:string;readonly contextHash?:string;readonly pairHash?:string;readonly bondStrength?:number;readonly bondAge?:number;readonly clusterSize?:number;readonly clusterAge?:number;readonly clusterStability?:number;readonly eventAge?:number;readonly eventType?:string;readonly dimension?:string}
export interface VfxDriver {readonly id:VfxDriverId;read(context:VfxDriverContext):number|undefined}
const hashFraction=(value?:string)=>value&&/^[0-9a-f]{64}$/.test(value)?Number.parseInt(value.slice(0,8),16)/0xffffffff:undefined;
const enumFraction=(value:string|undefined,values:readonly string[])=>value===undefined?undefined:Math.max(0,values.indexOf(value))/Math.max(1,values.length-1);
const drivers:readonly VfxDriver[]=[
 {id:'Manual',read:c=>c.manual},{id:'Entity Hash',read:c=>hashFraction(c.entityHash)},{id:'Context Hash',read:c=>hashFraction(c.contextHash)},{id:'Pair Hash',read:c=>hashFraction(c.pairHash)},
 {id:'Bond Strength',read:c=>c.bondStrength},{id:'Absolute Bond Strength',read:c=>c.bondStrength===undefined?undefined:Math.abs(c.bondStrength)},{id:'Bond Age',read:c=>c.bondAge},
 {id:'Cluster Size',read:c=>c.clusterSize},{id:'Cluster Age',read:c=>c.clusterAge},{id:'Cluster Stability',read:c=>c.clusterStability},{id:'Event Age',read:c=>c.eventAge},
 {id:'Event Type',read:c=>enumFraction(c.eventType,['positive-bond-created','negative-bond-created','bond-dissolved','entity-injected','entity-condensed','cluster-formed','cluster-dissolved'])},
 {id:'Dimension',read:c=>c.dimension==='dimension-0'?0:undefined},
];
export class VfxDriverRegistry{private readonly values=new Map<VfxDriverId,VfxDriver>();constructor(initial=drivers){for(const driver of initial){if(this.values.has(driver.id))throw new Error(`Duplicate VFX driver: ${driver.id}`);this.values.set(driver.id,driver)}}list(){return [...this.values.values()]}read(id:VfxDriverId,context:VfxDriverContext){const driver=this.values.get(id);if(!driver)throw new Error(`Unknown VFX driver: ${id}`);return driver.read(context)}}
export const vfxDrivers=new VfxDriverRegistry();
