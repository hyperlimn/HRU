import { performance } from 'node:perf_hooks';
import { DIMENSION_ZERO } from '../src/shared/ids';
import { UniverseEngine } from '../server/law/engine';
import { createGenesisState } from '../server/law/entities';
import { createLawV1Manifest } from '../server/law/manifest';
import { summarize } from '../server/law/summary-instruments';

const targetTick = 100_000;
const manifest = createLawV1Manifest('1970-01-01T00:00:00.000Z');
const engine = new UniverseEngine(createGenesisState(manifest));
const started = performance.now();
engine.advance(targetTick);
const elapsedSeconds = (performance.now() - started) / 1000;
const summary = summarize(engine.snapshot(), {
  running: false, requestedMultiplier: 1, actualTicksPerSecond: targetTick / elapsedSeconds,
  activeDimension: DIMENSION_ZERO, autosaveStatus: 'idle',
});

console.log(JSON.stringify({
  tick: summary.tick, digest: summary.stateDigest, entities: summary.entityCount, bonds: summary.totalBondCount,
  activePositiveBonds: summary.activePositiveBondCount, activeRepulsions: summary.activeRepulsionCount,
  clusters: summary.clusterCount, largestCluster: summary.largestClusterSize,
  condensations: summary.condensedEntityCount, injections: summary.injectedEntityCount,
  elapsedSeconds, ticksPerSecond: targetTick / elapsedSeconds,
}, null, 2));
