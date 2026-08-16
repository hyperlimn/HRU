import { describe, expect, it } from 'vitest';
import { createGenesisState } from '../law/entities';
import { createLawV1Manifest } from '../law/manifest';
import { SimulationWorkerHost } from './simulation-worker-host';

describe('worker observation lifecycle',()=>{
  it('projects two genesis entities and clears observer cursors on resume',async()=>{const state=createGenesisState(createLawV1Manifest('metadata'));const worker=new SimulationWorkerHost();await worker.start(state);try{expect((await worker.getObservationFrame()).entities).toHaveLength(2);const before=await worker.getObservationEvents();await worker.replaceState(state);const after=await worker.getObservationEvents(before.nextCursor);expect(after.generation).toBe(before.generation+1);expect(after.droppedBeforeCursor).toBe(true);}finally{await worker.stop();}},15000);
});
