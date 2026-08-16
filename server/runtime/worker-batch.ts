import type { AuthoritativeUniverseState } from '../../src/core/state';
import { AUTOSAVE_INTERVAL_TICKS } from '../../src/modules/saves/save-system';
import type { UniverseEngine } from '../law/engine';

export function advanceWorkerBatch(engine: UniverseEngine, count: number, onAutosaveBoundary: (state: AuthoritativeUniverseState) => void): void {
  for (let index = 0; index < count; index += 1) {
    const state = engine.advanceOne();
    if (state.tick % AUTOSAVE_INTERVAL_TICKS === 0) onAutosaveBoundary(state);
  }
}
