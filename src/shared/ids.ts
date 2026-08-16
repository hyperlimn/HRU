export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type UniverseID = Brand<string, 'UniverseID'>;
export type DimensionID = Brand<string, 'DimensionID'>;
export type SnapshotID = Brand<string, 'SnapshotID'>;
export type HashHex = Brand<string, 'HashHex'>;
export type BondKey = Brand<string, 'BondKey'>;

export const DIMENSION_ZERO = 'dimension-0' as DimensionID;
export const DEFAULT_UNIVERSE_ID = 'hru-universe-0' as UniverseID;
