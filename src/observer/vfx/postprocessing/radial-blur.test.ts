import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {aggregateRadialBlur,radialBlurEvents} from './radial-blur';
import {visualRegistry} from '../../../visual-lab/registry';
import type {ObservationFrame,RelationshipEvent} from '../../observation-types';
import type {HashHex} from '../../../shared/ids';

const a='11'.repeat(32) as HashHex,b='22'.repeat(32) as HashHex,z='00'.repeat(32) as HashHex;
const frame:ObservationFrame={tick:20,stateDigest:'aa'.repeat(32) as HashHex,entities:[{hash:a,provenance:{origin:'genesis',createdAtTick:0,seed:'seed1'},createdAtTick:0,contextHash:z},{hash:b,provenance:{origin:'genesis',createdAtTick:0,seed:'seed2'},createdAtTick:0,contextHash:z}],bonds:[],clusters:[],condensationRecords:[]};
const event:RelationshipEvent={eventId:'33'.repeat(32) as HashHex,tick:10,type:'positive-bond-created',participants:[a,b],strength:.8};
const values=()=>({...visualRegistry.defaults(),'vfx.radialBlur.enabled':true,'vfx.radialBlur.maxEvents':4});
describe('radial blur deterministic observer state',()=>{
 it('uses deterministic event identity and relationship midpoint',()=>{const v=values(),e=radialBlurEvents(frame,[{event,observedAt:0}],undefined,v),again=radialBlurEvents(frame,[{event,observedAt:999}],undefined,v);expect(e[0]?.id).toBe(again[0]?.id);expect(e[0]?.center.x).toBeCloseTo(again[0]!.center.x);expect(e[0]?.center.distanceTo(again[0]!.center)).toBe(0)});
 it('prioritizes deterministically when simultaneous events exceed the budget',()=>{const v={...values(),'vfx.radialBlur.maxEvents':1};const other={...event,eventId:'44'.repeat(32) as HashHex,strength:.2};expect(radialBlurEvents(frame,[{event:other,observedAt:0},{event,observedAt:0}],undefined,v)[0]?.id).toBe(radialBlurEvents(frame,[{event,observedAt:1},{event:other,observedAt:1}],undefined,v)[0]?.id)});
 it('maps the same state and tick to the same projected blur aggregate',()=>{const v=values(),camera=new THREE.PerspectiveCamera(55,1,.1,200);camera.position.set(0,0,20);camera.lookAt(0,0,0);camera.updateProjectionMatrix();const x=aggregateRadialBlur(frame,[{event,observedAt:0}],undefined,camera,v),y=aggregateRadialBlur(frame,[{event,observedAt:400}],undefined,camera,v);expect(x.center.x).toBe(y.center.x);expect(x.center.y).toBe(y.center.y);expect(x.strength).toBe(y.strength)});
 it('pause-safe state is tick-based rather than wall-clock based',()=>{const v=values();const first=radialBlurEvents(frame,[{event,observedAt:1}],undefined,v);const sameTick=radialBlurEvents({...frame,tick:20},[{event,observedAt:100000}],undefined,v);expect(first.map(x=>x.id)).toEqual(sameTick.map(x=>x.id));});
});
