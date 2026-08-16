import type { AuthoritativeUniverseState, RuntimeSummary } from '../../src/core/state';
import type { Multiplier } from '../../src/interface/protocol';
import type { ObservationCursor, ObservationEventBatch, ObservationFrame, ObservedEntityDetail, SequencedRelationshipEvent } from '../../src/observer/observation-types';
import type { HashHex } from '../../src/shared/ids';

export type WorkerRequest =
  | { readonly type: 'initialize'; readonly requestId: string; readonly state: AuthoritativeUniverseState }
  | { readonly type: 'set-running'; readonly requestId: string; readonly running: boolean }
  | { readonly type: 'set-multiplier'; readonly requestId: string; readonly multiplier: Multiplier }
  | { readonly type: 'get-state'; readonly requestId: string }
  | { readonly type: 'get-summary'; readonly requestId: string }
  | { readonly type: 'get-observation-frame'; readonly requestId: string }
  | { readonly type: 'get-observation-events'; readonly requestId: string; readonly cursor?: ObservationCursor; readonly limit?: number }
  | { readonly type: 'get-observed-entity'; readonly requestId: string; readonly hash: HashHex }
  | { readonly type: 'replace-state'; readonly requestId: string; readonly state: AuthoritativeUniverseState };

export type WorkerResponse =
  | { readonly type: 'ready' }
  | { readonly type: 'response'; readonly requestId: string; readonly ok: true; readonly data?: AuthoritativeUniverseState | RuntimeSummary | ObservationFrame | ObservationEventBatch | ObservedEntityDetail }
  | { readonly type: 'response'; readonly requestId: string; readonly ok: false; readonly message: string }
  | { readonly type: 'summary'; readonly summary: RuntimeSummary }
  | { readonly type: 'observation-events'; readonly events: readonly SequencedRelationshipEvent[]; readonly generation: number }
  | { readonly type: 'autosave-boundary'; readonly tick: number; readonly state: AuthoritativeUniverseState };
