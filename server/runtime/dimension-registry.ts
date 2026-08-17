import type { UniverseSnapshot } from "../../src/core/state";
import {
  dimensionZero,
  type DimensionProjection,
  type DimensionSystem,
} from "../../src/modules/dimensions/dimension-system";
import type { DimensionID } from "../../src/shared/ids";

export class DimensionRegistry implements DimensionSystem {
  private readonly projections = new Map<DimensionID, DimensionProjection>();

  constructor(initial: readonly DimensionProjection[] = [dimensionZero]) {
    for (const projection of initial) this.register(projection);
  }

  register(projection: DimensionProjection): void {
    if (this.projections.has(projection.id))
      throw new Error(`Duplicate dimension: ${projection.id}`);
    this.projections.set(projection.id, Object.freeze(projection));
  }

  list(): readonly DimensionProjection[] {
    return [...this.projections.values()];
  }
  project(id: DimensionID, snapshot: UniverseSnapshot): UniverseSnapshot {
    const projection = this.projections.get(id);
    if (!projection) throw new Error(`Unknown dimension: ${id}`);
    return projection.project(snapshot);
  }
}
