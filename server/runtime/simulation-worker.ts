import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { DIMENSION_ZERO } from '../../src/shared/ids';
import type { AuthoritativeUniverseState, RuntimeSummary } from '../../src/core/state';
import type { Multiplier } from '../../src/interface/protocol';
import { UniverseEngine } from '../law/engine';
import { summarize } from '../law/summary-instruments';
import { TickRateMeter } from './tick-rate-meter';
import type { WorkerRequest, WorkerResponse } from './worker-protocol';
import { advanceWorkerBatch } from './worker-batch';
import { ObservationEventBuffer } from '../observation/event-buffer';
import { deriveObservationEvents } from '../observation/events';
import { projectEntityDetail, projectObservationFrame } from '../observation/projection';
import type { ObservationEventBatch, ObservationFrame, ObservedEntityDetail } from '../../src/observer/observation-types';

if (!parentPort) throw new Error('Simulation worker requires a parent port');
const port = parentPort;
let engine: UniverseEngine | undefined;
let running = false;
let multiplier: Multiplier = 1;
let credit = 0;
let previousPump = performance.now();
let previousSummary = 0;
const tickRate = new TickRateMeter(500);
let actualTicksPerSecond = 0;
const eventBuffer = new ObservationEventBuffer(4096);

const post = (message: WorkerResponse) => port.postMessage(message);
const currentSummary = (): RuntimeSummary => {
  if (!engine) throw new Error('Worker is not initialized');
  return summarize(engine.snapshot(), { running, requestedMultiplier: multiplier, actualTicksPerSecond, activeDimension: DIMENSION_ZERO, autosaveStatus: 'idle' });
};
const emitSummary = () => { const summary = currentSummary(); post({ type: 'summary', summary }); return summary; };

function pump(): void {
  const now = performance.now(); const elapsed = now - previousPump; previousPump = now;
  if (running && engine) {
    credit = Math.min(credit + elapsed / 1000 * 20 * multiplier, 20 * multiplier * 0.25);
    const count = Math.min(Math.floor(credit), 128); credit -= count;
    const batchEvents = [] as ReturnType<typeof deriveObservationEvents>[number][];
    advanceWorkerBatch(engine, count, (state) => post({ type: 'autosave-boundary', tick: state.tick, state }), (before, after) => batchEvents.push(...deriveObservationEvents(before, after)));
    if (batchEvents.length) {
      const sequenced = eventBuffer.push(batchEvents); const bounded = sequenced.slice(-256);
      post({ type: 'observation-events', events: bounded, generation: eventBuffer.read().generation });
    }
    if (count > 0) actualTicksPerSecond = tickRate.record(now, engine.snapshot().tick);
  }
  if (engine && now - previousSummary >= 100) { emitSummary(); previousSummary = now; }
}
setInterval(pump, 5);

port.on('message', (request: WorkerRequest) => {
  try {
    let data: AuthoritativeUniverseState | RuntimeSummary | ObservationFrame | ObservationEventBatch | ObservedEntityDetail | undefined;
    switch (request.type) {
      case 'initialize': engine = new UniverseEngine(request.state); running = false; multiplier = 1; credit = 0; actualTicksPerSecond = 0; tickRate.reset(); data = emitSummary(); break;
      case 'set-running': running = request.running; credit = 0; actualTicksPerSecond = tickRate.reset(); if (running && engine) tickRate.record(performance.now(), engine.snapshot().tick); data = emitSummary(); break;
      case 'set-multiplier': multiplier = request.multiplier; credit = 0; data = emitSummary(); break;
      case 'get-state': data = engine?.snapshot(); if (!data) throw new Error('Worker is not initialized'); break;
      case 'get-summary': data = currentSummary(); break;
      case 'get-observation-frame': if (!engine) throw new Error('Worker is not initialized'); data = projectObservationFrame(engine.snapshot()); break;
      case 'get-observation-events': data = eventBuffer.read(request.cursor, request.limit); break;
      case 'get-observed-entity': if (!engine) throw new Error('Worker is not initialized'); data = projectEntityDetail(projectObservationFrame(engine.snapshot()), request.hash); break;
      case 'replace-state': engine?.replace(request.state); if (!engine) engine = new UniverseEngine(request.state); eventBuffer.clear(); running = false; credit = 0; actualTicksPerSecond = tickRate.reset(); data = emitSummary(); break;
    }
    post({ type: 'response', requestId: request.requestId, ok: true, ...(data === undefined ? {} : { data }) });
  } catch (error) { post({ type: 'response', requestId: request.requestId, ok: false, message: error instanceof Error ? error.message : String(error) }); }
});

post({ type: 'ready' });
