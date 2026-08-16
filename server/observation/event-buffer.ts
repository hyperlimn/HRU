import type { ObservationCursor, ObservationEventBatch, RelationshipEvent, SequencedRelationshipEvent } from '../../src/observer/observation-types';

export class ObservationEventBuffer {
  private events: SequencedRelationshipEvent[] = []; private generation = 0; private nextSequence = 0;
  constructor(private readonly capacity = 4096) { if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('Event capacity must be positive'); }
  push(events: readonly RelationshipEvent[]): readonly SequencedRelationshipEvent[] {
    const sequenced = events.map((event) => ({ sequence: this.nextSequence++, event })); this.events.push(...sequenced);
    if (this.events.length > this.capacity) this.events.splice(0, this.events.length - this.capacity); return sequenced;
  }
  read(cursor?: ObservationCursor, limit = 256): ObservationEventBatch {
    const bounded = Math.max(1, Math.min(1024, Math.trunc(limit))); const first = this.events[0]?.sequence ?? this.nextSequence;
    const validGeneration = cursor?.generation === this.generation; const requested = validGeneration ? cursor.sequence : first;
    const droppedBeforeCursor = !validGeneration || requested < first; const start = droppedBeforeCursor ? first : requested;
    const events = this.events.filter((entry) => entry.sequence >= start).slice(0, bounded);
    const sequence = events.length ? events[events.length - 1]!.sequence + 1 : Math.max(start, this.nextSequence);
    return { generation: this.generation, events, nextCursor: { generation: this.generation, sequence }, droppedBeforeCursor };
  }
  clear(): void { this.events = []; this.generation += 1; this.nextSequence = 0; }
  get size(): number { return this.events.length; }
}
