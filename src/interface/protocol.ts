import type { UniverseSnapshot } from '../core/state';
import type { DimensionID, SnapshotID } from '../shared/ids';

export const MULTIPLIERS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000] as const;
export type Multiplier = (typeof MULTIPLIERS)[number];

export type Command =
  | { readonly type: 'time/set-running'; readonly running: boolean }
  | { readonly type: 'time/set-multiplier'; readonly multiplier: Multiplier }
  | { readonly type: 'saves/save-current'; readonly label?: string }
  | { readonly type: 'saves/resume'; readonly snapshotId: SnapshotID }
  | { readonly type: 'dimensions/select'; readonly dimensionId: DimensionID };

export type Query =
  | { readonly type: 'universe/state' }
  | { readonly type: 'saves/list' }
  | { readonly type: 'dimensions/list' }
  | { readonly type: 'laboratory/list' }
  | { readonly type: 'modules/list' };

export interface CommandResult { readonly ok: boolean; readonly data?: unknown; readonly message?: string }
export interface QueryResult { readonly ok: boolean; readonly data?: unknown; readonly message?: string }

export type ClientMessage =
  | { readonly kind: 'command'; readonly requestId: string; readonly payload: Command }
  | { readonly kind: 'query'; readonly requestId: string; readonly payload: Query };

export type ServerMessage =
  | { readonly kind: 'response'; readonly requestId: string; readonly payload: CommandResult | QueryResult }
  | { readonly kind: 'snapshot'; readonly payload: UniverseSnapshot }
  | { readonly kind: 'status'; readonly payload: { readonly connected: boolean } };
