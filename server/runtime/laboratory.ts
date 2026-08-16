import type { UniverseSnapshot } from '../../src/core/state';
import type { ExperimentModule, Laboratory } from '../../src/modules/laboratory/experiment-system';

export class EmptyLaboratory implements Laboratory {
  private readonly experiments = new Map<string, ExperimentModule>();
  list(): readonly ExperimentModule[] { return [...this.experiments.values()]; }
  async run<TResult>(id: string, snapshot: UniverseSnapshot): Promise<TResult> {
    const experiment = this.experiments.get(id);
    if (!experiment) throw new Error(`Unknown experiment: ${id}`);
    return experiment.run({ fork: structuredClone(snapshot) }) as Promise<TResult>;
  }
}
