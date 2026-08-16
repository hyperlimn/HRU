import type { UniverseSnapshot } from '../../core/state';

export interface ExperimentContext {
  /** An isolated snapshot fork. Experiments never receive the canonical mutable runtime. */
  readonly fork: UniverseSnapshot;
}

export interface ExperimentModule<TResult = unknown> {
  readonly id: string;
  readonly label: string;
  run(context: ExperimentContext): Promise<TResult>;
}

export interface Laboratory {
  list(): readonly ExperimentModule[];
  run<TResult>(id: string, snapshot: UniverseSnapshot): Promise<TResult>;
}
