import type {
  RendererCapabilities,
  VfxModuleDefinition,
} from "../shared/types";
import { unmetRequirement } from "../capability/capabilities";
import {
  bloomModule,
  selectiveBloomModule,
  radialBlurModule,
} from "../postprocessing/modules";
import { preparedVfxModules } from "../procedural/stubs";
import { particleFieldModule } from "../procedural/particle-field-module";
import { vortexFieldModule } from "../procedural/vortex-field-module";
export const builtInVfxModules: readonly VfxModuleDefinition[] = [
  bloomModule,
  selectiveBloomModule,
  radialBlurModule,
  particleFieldModule,
  vortexFieldModule,
  ...preparedVfxModules,
];
export class VfxModuleRegistry {
  private readonly modules = new Map<string, VfxModuleDefinition>();
  constructor(initial = builtInVfxModules) {
    for (const module of initial) {
      if (this.modules.has(module.id))
        throw new Error(`Duplicate VFX module: ${module.id}`);
      this.modules.set(module.id, Object.freeze(module));
    }
  }
  list(capabilities?: RendererCapabilities) {
    return [...this.modules.values()].map((module) => ({
      ...module,
      unavailableReason: capabilities
        ? unmetRequirement(capabilities, module.requirements)
        : undefined,
    }));
  }
}
export const vfxModuleRegistry = new VfxModuleRegistry();
