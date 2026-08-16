import type { CondensationRecord, EntityProvenance } from '../core/state';
import type { HashHex } from '../shared/ids';

export type BondClassification = 'weak-positive' | 'active-positive' | 'weak-negative' | 'active-repulsion';

export interface ObservedEntity {
  readonly hash: HashHex;
  readonly provenance: EntityProvenance;
  readonly createdAtTick: number;
  readonly contextHash: HashHex;
  readonly clusterHash?: HashHex;
}

export interface ObservedBond {
  readonly low: HashHex;
  readonly high: HashHex;
  readonly strength: number;
  readonly classification: BondClassification;
}

export interface ObservedCluster {
  readonly clusterHash: HashHex;
  readonly memberHashes: readonly HashHex[];
}

export interface ObservationFrame {
  readonly tick: number;
  readonly stateDigest: HashHex;
  readonly entities: readonly ObservedEntity[];
  readonly bonds: readonly ObservedBond[];
  readonly clusters: readonly ObservedCluster[];
  readonly condensationRecords: readonly CondensationRecord[];
}

export type RelationshipEventType =
  | 'positive-bond-created' | 'negative-bond-created' | 'bond-dissolved'
  | 'bond-became-active-positive' | 'bond-became-active-repulsion'
  | 'bond-left-active-positive' | 'bond-left-active-repulsion'
  | 'entity-injected' | 'entity-condensed' | 'cluster-formed' | 'cluster-dissolved';

export interface RelationshipEvent {
  readonly eventId: HashHex;
  readonly tick: number;
  readonly type: RelationshipEventType;
  readonly participants: readonly HashHex[];
  readonly strength?: number;
  readonly clusterHash?: HashHex;
}

export interface ObservationCursor { readonly generation: number; readonly sequence: number }
export interface SequencedRelationshipEvent { readonly sequence: number; readonly event: RelationshipEvent }
export interface ObservationEventBatch {
  readonly generation: number;
  readonly events: readonly SequencedRelationshipEvent[];
  readonly nextCursor: ObservationCursor;
  readonly droppedBeforeCursor: boolean;
}

export interface ObservedEntityDetail extends ObservedEntity {
  readonly cluster?: ObservedCluster;
  readonly bonds: readonly (ObservedBond & { readonly neighborHash: HashHex })[];
}

export interface RecentActivityCounts {
  readonly positiveCreated: number; readonly negativeCreated: number; readonly dissolved: number;
  readonly activeTransitions: number; readonly clustersFormed: number; readonly clustersDissolved: number;
  readonly injections: number; readonly condensations: number;
}
