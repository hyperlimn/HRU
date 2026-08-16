export interface HruModule {
  readonly id: string;
  readonly label: string;
  readonly version: string;
  readonly deterministic: boolean;
}

export class ModuleRegistry {
  private readonly modules = new Map<string, HruModule>();

  register(module: HruModule): void {
    if (this.modules.has(module.id)) throw new Error(`Module already registered: ${module.id}`);
    this.modules.set(module.id, Object.freeze(module));
  }

  list(): readonly HruModule[] { return [...this.modules.values()]; }
  get size(): number { return this.modules.size; }
}
