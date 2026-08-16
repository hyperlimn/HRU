import { DIMENSION_ZERO, type DimensionID } from '../../shared/ids';
import type { UniverseSnapshot } from '../../core/state';

export interface DimensionProjection {
  readonly id: DimensionID;
  readonly label: string;
  project(snapshot: UniverseSnapshot): UniverseSnapshot;
}

export interface DimensionSystem {
  list(): readonly DimensionProjection[];
  project(id: DimensionID, snapshot: UniverseSnapshot): UniverseSnapshot;
}

export const dimensionZero: DimensionProjection = {
  id: DIMENSION_ZERO,
  label: 'Dimension 0',
  project: (snapshot) => snapshot,
};
