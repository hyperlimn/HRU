import { describe, expect, it } from 'vitest';
import type { RelationshipEvent } from '../../src/observer/observation-types';
import { parseHashHex } from '../law/canonical-encoding';
import { ObservationEventBuffer } from './event-buffer';

const makeEvent=(tick:number):RelationshipEvent=>({eventId:parseHashHex(tick.toString(16).padStart(64,'0')),tick,type:'entity-injected',participants:[parseHashHex('11'.repeat(32))]});
describe('ObservationEventBuffer',()=>{
  it('is bounded and retrieves by cursor',()=>{const buffer=new ObservationEventBuffer(3);buffer.push([makeEvent(1),makeEvent(2),makeEvent(3),makeEvent(4)]);expect(buffer.size).toBe(3);const first=buffer.read(undefined,2);expect(first.events.map(({event})=>event.tick)).toEqual([2,3]);const second=buffer.read(first.nextCursor,2);expect(second.events.map(({event})=>event.tick)).toEqual([4]);});
  it('invalidates stale cursors on clear',()=>{const buffer=new ObservationEventBuffer(3);buffer.push([makeEvent(1)]);const cursor=buffer.read().nextCursor;buffer.clear();const after=buffer.read(cursor);expect(after.generation).toBe(1);expect(after.droppedBeforeCursor).toBe(true);expect(after.events).toEqual([]);});
});
