import type { UniverseSnapshot } from '../../src/core/state';
import { dimensionZero, type DimensionProjection, type DimensionSystem } from '../../src/modules/dimensions/dimension-system';
import type { DimensionID } from '../../src/shared/ids';

export class DimensionRegistry implements DimensionSystem {
  private readonly projections = new Map<DimensionID, DimensionProjection>([[dimensionZero.id, dimensionZero]]);
  list(): readonly DimensionProjection[] { return [...this.projections.values()]; }
  project(id: DimensionID, snapshot: UniverseSnapshot): UniverseSnapshot {
    const projection = this.projections.get(id);
    if (!projection) throw new Error(`Unknown dimension: ${id}`);
    return projection.project(snapshot);
  }
}
