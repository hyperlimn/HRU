import type { VfxModuleDefinition } from "../shared/types";
export const preparedVfxModules: readonly VfxModuleDefinition[] = [
  {
    id: "linked-particles",
    label: "Linked Particles",
    status: "unavailable",
    requirements: [
      { capability: "compute", reason: "native WebGPU compute required" },
    ],
    targets: ["Relationships"],
    intendedParameters: ["Particle budget", "Link budget"],
    performance: "high",
  },
];
