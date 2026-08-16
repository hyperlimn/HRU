import type { UniverseSnapshot } from '../../core/state';
import type { SnapshotID } from '../../shared/ids';

export const AUTOSAVE_INTERVAL_TICKS = 100_000;
export const AUTOSAVE_SLOTS = 3;

export interface SavedSnapshot {
  readonly id: SnapshotID;
  readonly kind: 'autosave' | 'manual';
  readonly label: string;
  readonly state: UniverseSnapshot;
  readonly savedAt: string;
}

export interface SaveStore {
  saveAutosave(state: UniverseSnapshot): Promise<SavedSnapshot>;
  saveManual(state: UniverseSnapshot, label?: string): Promise<SavedSnapshot>;
  list(): Promise<readonly SavedSnapshot[]>;
  load(id: SnapshotID): Promise<UniverseSnapshot | undefined>;
}
