import type { AuthoritativeUniverseState } from '../../src/core/state';
import { AUTOSAVE_INTERVAL_TICKS } from '../../src/modules/saves/save-system';
import type { UniverseEngine } from '../law/engine';

export function advanceWorkerBatch(engine: UniverseEngine, count: number, onAutosaveBoundary: (state: AuthoritativeUniverseState) => void, onTick?: (before: AuthoritativeUniverseState, after: AuthoritativeUniverseState) => void): void {
  for (let index = 0; index < count; index += 1) {
    const before = onTick ? engine.snapshot() : undefined;
    const state = engine.advanceOne();
    if (before) onTick?.(before, state);
    if (state.tick % AUTOSAVE_INTERVAL_TICKS === 0) onAutosaveBoundary(state);
  }
}
