import type { UniverseSnapshot } from "../../src/core/state";
import type {
  ExperimentModule,
  Laboratory,
} from "../../src/modules/laboratory/experiment-system";

export class ExperimentRegistry implements Laboratory {
  private readonly experiments = new Map<string, ExperimentModule>();

  constructor(initial: readonly ExperimentModule[] = []) {
    for (const experiment of initial) this.register(experiment);
  }

  register(experiment: ExperimentModule): void {
    if (this.experiments.has(experiment.id))
      throw new Error(`Duplicate experiment: ${experiment.id}`);
    this.experiments.set(experiment.id, Object.freeze(experiment));
  }

  list(): readonly ExperimentModule[] {
    return [...this.experiments.values()];
  }
  async run<TResult>(id: string, snapshot: UniverseSnapshot): Promise<TResult> {
    const experiment = this.experiments.get(id);
    if (!experiment) throw new Error(`Unknown experiment: ${id}`);
    return experiment.run({
      fork: structuredClone(snapshot),
    }) as Promise<TResult>;
  }
}
