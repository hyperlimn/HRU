import type { VfxModuleDefinition } from "../shared/types";
const postprocessing = [
  {
    capability: "postprocessing" as const,
    reason: "WebGL postprocessing is unavailable",
  },
];
export const bloomModule: VfxModuleDefinition = {
  id: "bloom",
  label: "Bloom",
  status: "functional",
  requirements: postprocessing,
  targets: ["World"],
  intendedParameters: ["Enabled", "Quality", "Strength", "Radius", "Threshold"],
  performance: "medium",
};
export const selectiveBloomModule: VfxModuleDefinition = {
  id: "selective-bloom",
  label: "Selective Bloom",
  status: "functional",
  requirements: postprocessing,
  targets: [
    "Entities",
    "Selected Entity",
    "Positive Bonds",
    "Weak Bonds",
    "Repulsion",
    "Clusters",
  ],
  intendedParameters: ["Enabled", "Quality", "Target", "Driver routing"],
  performance: "medium",
};
export const radialBlurModule: VfxModuleDefinition = {
  id: "radial-blur",
  label: "Radial Blur",
  status: "functional",
  requirements: postprocessing,
  targets: [
    "World",
    "Entities",
    "Selected Entity",
    "Positive Bonds",
    "Weak Bonds",
    "Repulsion",
    "Relationships",
    "Clusters",
    "Contexts",
    "Condensed Entities",
    "Events",
  ],
  intendedParameters: [
    "Tick-derived event distortions",
    "Center routing",
    "Driver composition",
  ],
  performance: "high",
};
