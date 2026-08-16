import { describe, expect, it } from 'vitest';
import { UniverseEngine } from './engine';
import { createGenesisState } from './entities';
import { createLawV1Manifest } from './manifest';
import { stateDigest } from './state-digest';

describe('Law v1 observation regression',()=>{it('retains the exact tick-100,000 digest',()=>{const engine=new UniverseEngine(createGenesisState(createLawV1Manifest('1970-01-01T00:00:00.000Z')));engine.advance(100_000);expect(stateDigest(engine.snapshot())).toBe('f478f37ba9871378b9fec678b13155267b77bc1565fe9c3cb01246e455233a3c');},30000);});
