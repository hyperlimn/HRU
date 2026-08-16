import type { AuthoritativeUniverseState, RuntimeSummary } from '../../src/core/state';
import type { Multiplier } from '../../src/interface/protocol';

export type WorkerRequest =
  | { readonly type: 'initialize'; readonly requestId: string; readonly state: AuthoritativeUniverseState }
  | { readonly type: 'set-running'; readonly requestId: string; readonly running: boolean }
  | { readonly type: 'set-multiplier'; readonly requestId: string; readonly multiplier: Multiplier }
  | { readonly type: 'get-state'; readonly requestId: string }
  | { readonly type: 'get-summary'; readonly requestId: string }
  | { readonly type: 'replace-state'; readonly requestId: string; readonly state: AuthoritativeUniverseState };

export type WorkerResponse =
  | { readonly type: 'ready' }
  | { readonly type: 'response'; readonly requestId: string; readonly ok: true; readonly data?: AuthoritativeUniverseState | RuntimeSummary }
  | { readonly type: 'response'; readonly requestId: string; readonly ok: false; readonly message: string }
  | { readonly type: 'summary'; readonly summary: RuntimeSummary }
  | { readonly type: 'autosave-boundary'; readonly tick: number; readonly state: AuthoritativeUniverseState };
