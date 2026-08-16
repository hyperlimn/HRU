import { describe, expect, it } from 'vitest';
import { ModuleRegistry } from './module-registry';

describe('ModuleRegistry', () => {
  it('rejects duplicate module IDs', () => {
    const registry = new ModuleRegistry(); const module = { id: 'x', label: 'X', version: '0', deterministic: true };
    registry.register(module); expect(() => registry.register(module)).toThrow('already registered');
  });
});
