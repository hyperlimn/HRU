import type { UniverseSnapshot } from '../../core/state';

export interface Instrument<TReading = unknown> {
  readonly id: string;
  readonly label: string;
  read(snapshot: UniverseSnapshot): TReading;
}
