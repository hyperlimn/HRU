import type { VisualConfiguration, VisualParameterDefinition, VisualValue } from './types';

export class TypedVisualParameterRegistry {
  private readonly byId = new Map<string, VisualParameterDefinition>();

  constructor(definitions: readonly VisualParameterDefinition[]) {
    for (const definition of definitions) {
      if (this.byId.has(definition.id)) throw new Error(`Duplicate visual parameter: ${definition.id}`);
      this.byId.set(definition.id, Object.freeze(definition));
      this.validate(definition.id, definition.defaultValue);
    }
  }

  list(): readonly VisualParameterDefinition[] { return [...this.byId.values()]; }

  get(id: string): VisualParameterDefinition {
    const found = this.byId.get(id);
    if (!found) throw new Error(`Unknown visual parameter: ${id}`);
    return found;
  }

  defaults(): VisualConfiguration {
    return Object.fromEntries(this.list().map((item) => [item.id, item.defaultValue]));
  }

  validate(id: string, value: VisualValue, clamp = false): VisualValue {
    const definition = this.get(id);
    if (definition.type === 'palette-id') {
      if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(value)) throw new Error(`${id} requires a stable lowercase palette ID`);
      return value;
    }
    if (definition.type === 'boolean') {
      if (typeof value !== 'boolean') throw new Error(`${id} requires boolean`);
      return value;
    }
    if (definition.type === 'color') {
      if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error(`${id} requires a six-digit hexadecimal color such as #52d8ff`);
      return value.toLowerCase();
    }
    if (definition.type === 'select') {
      if (typeof value !== 'string' || !definition.options?.includes(value)) throw new Error(`${id} must be one of: ${definition.options?.join(', ')}`);
      return value;
    }
    if (definition.type === 'vector3') {
      if (!Array.isArray(value) || value.length !== 3 || value.some((part) => typeof part !== 'number' || !Number.isFinite(part))) throw new Error(`${id} requires three finite numbers`);
      const vector = value as readonly number[];
      if (vector.some((part) => part < (definition.min ?? -Infinity) || part > (definition.max ?? Infinity)) && !clamp) throw new Error(`${id} exceeds the technically safe coordinate range ${definition.min} to ${definition.max}`);
      return vector.map((part) => Math.max(definition.min ?? -Infinity, Math.min(definition.max ?? Infinity, part))) as [number, number, number];
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${id} requires a finite number; NaN and Infinity cannot be rendered`);
    if (definition.integer && !Number.isInteger(value)) throw new Error(`${id} requires a whole number because it controls a resource count`);
    if ((value < (definition.min ?? -Infinity) || value > (definition.max ?? Infinity)) && !clamp) throw new Error(`${id} is outside its technical range ${definition.min ?? 'unbounded'} to ${definition.max ?? 'unbounded'}`);
    return clamp ? Math.max(definition.min ?? -Infinity, Math.min(definition.max ?? Infinity, value)) : value;
  }
}
