import type { UniverseManifest } from './universe-manifest';
import type { DimensionID } from '../shared/ids';

export interface UniverseState {
  readonly manifest: UniverseManifest;
  readonly tick: number;
  readonly running: boolean;
  readonly requestedMultiplier: number;
  readonly actualTicksPerSecond: number;
  readonly activeDimension: DimensionID;
}

export type UniverseSnapshot = Readonly<UniverseState>;
