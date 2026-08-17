import type {
  VisualConfiguration,
  VisualParameterDefinition,
  VisualValue,
} from "./types";
import { particleFieldParameters } from "../observer/vfx/procedural/particle-field-parameters";
import { vortexFieldParameters } from "../observer/vfx/procedural/vortex-field-parameters";
import { radialBlurParameters } from "../observer/vfx/postprocessing/radial-blur-parameters";
import { TypedVisualParameterRegistry } from "./parameter-registry";
export const VISUAL_SCHEMA_VERSION = "hru-visual-1";
type RawParameter = Omit<
  VisualParameterDefinition,
  "category" | "subcategory" | "categoryOrder" | "sliderMin" | "sliderMax"
>;
const n = (
  id: string,
  group: string,
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
  updateMode: VisualParameterDefinition["updateMode"] = "immediate",
  performanceCost: VisualParameterDefinition["performanceCost"] = "low",
  advanced = false,
): RawParameter => ({
  id,
  group,
  label,
  description: `Controls ${label.toLowerCase()}. Technical ID: ${id}.`,
  type: "number",
  defaultValue,
  min,
  max,
  step,
  updateMode,
  performanceCost,
  advanced,
});
const b = (
  id: string,
  group: string,
  label: string,
  defaultValue: boolean,
  updateMode: VisualParameterDefinition["updateMode"] = "scene-object",
  advanced = false,
): RawParameter => ({
  id,
  group,
  label,
  description: `Shows or hides ${label.toLowerCase()}. Technical ID: ${id}.`,
  type: "boolean",
  defaultValue,
  updateMode,
  performanceCost: "negligible",
  advanced,
});
const c = (
  id: string,
  group: string,
  label: string,
  defaultValue: string,
): RawParameter => ({
  id,
  group,
  label,
  description: `Chooses ${label.toLowerCase()}. Technical ID: ${id}.`,
  type: "color",
  defaultValue,
  updateMode: "immediate",
  performanceCost: "negligible",
  advanced: false,
});
const s = (
  id: string,
  group: string,
  label: string,
  defaultValue: string,
  options: readonly string[],
  updateMode: VisualParameterDefinition["updateMode"] = "immediate",
): RawParameter => ({
  id,
  group,
  label,
  description: `Chooses ${label.toLowerCase()}. Technical ID: ${id}.`,
  type: "select",
  defaultValue,
  options,
  updateMode,
  performanceCost: "low",
  advanced: false,
});
const v = (
  id: string,
  group: string,
  label: string,
  defaultValue: readonly [number, number, number],
  updateMode: VisualParameterDefinition["updateMode"] = "scene-object",
): RawParameter => ({
  id,
  group,
  label,
  description: `Controls ${label.toLowerCase()} on the X, Y, and Z axes. Technical ID: ${id}.`,
  type: "vector3",
  defaultValue,
  step: 0.1,
  updateMode,
  performanceCost: "negligible",
  advanced: false,
});
const rawVisualParameters: readonly RawParameter[] = [
  c(
    "palette.background",
    "Color Palette",
    "Fallback palette background color",
    "#07090f",
  ),
  b("palette.enabled", "Color Palette", "Enable Global Palette", false),
  n(
    "palette.active",
    "Color Palette",
    "Active palette index",
    0,
    0,
    4,
    1,
    "scene-object",
  ),
  s(
    "palette.mappingMode",
    "Color Palette",
    "Palette mapping mode",
    "Continuous",
    ["Discrete", "Continuous", "Semantic role"],
  ),
  s("palette.interpolation", "Color Palette", "Palette interpolation", "RGB", [
    "RGB",
    "HSL",
  ]),
  b("palette.reverse", "Color Palette", "Reverse palette order", false),
  n(
    "palette.offset",
    "Color Palette",
    "Palette rotation / offset",
    0,
    -1,
    1,
    0.001,
  ),
  n(
    "palette.quantize",
    "Color Palette",
    "Palette quantization steps",
    0,
    0,
    32,
    1,
    "scene-object",
  ),
  c("scene.background", "Scene", "Background", "#07090f"),
  b("scene.fogEnabled", "Scene", "Fog", true),
  c("scene.fogColor", "Scene", "Fog color", "#07090f"),
  n("scene.fogDensity", "Scene", "Fog density", 0.025, 0, 0.2, 0.001),
  b("scene.gridEnabled", "Scene", "Grid", true),
  n(
    "scene.gridSize",
    "Scene",
    "Grid size",
    30,
    5,
    200,
    1,
    "geometry-rebuild",
    "medium",
  ),
  n(
    "scene.gridDivisions",
    "Scene",
    "Grid divisions",
    30,
    2,
    200,
    1,
    "geometry-rebuild",
    "medium",
  ),
  c("scene.gridPrimary", "Scene", "Primary grid color", "#193345"),
  c("scene.gridSecondary", "Scene", "Secondary grid color", "#101923"),
  n("scene.gridOpacity", "Scene", "Grid opacity", 1, 0, 1, 0.01),
  n(
    "scene.worldSpread",
    "Scene",
    "World spread",
    1,
    0.25,
    4,
    0.01,
    "geometry-rebuild",
    "medium",
  ),
  n(
    "scene.pixelRatioCap",
    "Scene",
    "Pixel ratio cap",
    2,
    0.5,
    3,
    0.1,
    "immediate",
    "high",
    true,
  ),
  s("scene.toneMapping", "Scene", "Tone mapping", "none", [
    "none",
    "linear",
    "reinhard",
    "aces",
  ]),
  n("scene.exposure", "Scene", "Exposure", 1, 0.1, 4, 0.01),
  n(
    "camera.fov",
    "Camera & Navigation",
    "Field of view",
    55,
    20,
    110,
    1,
    "scene-object",
  ),
  n(
    "camera.near",
    "Camera & Navigation",
    "Near clipping",
    0.1,
    0.01,
    10,
    0.01,
    "scene-object",
  ),
  n(
    "camera.far",
    "Camera & Navigation",
    "Far clipping",
    200,
    30,
    1000,
    1,
    "scene-object",
  ),
  b("camera.damping", "Camera & Navigation", "Damping", true),
  n(
    "camera.dampingFactor",
    "Camera & Navigation",
    "Damping factor",
    0.05,
    0.01,
    0.5,
    0.01,
  ),
  n(
    "camera.rotateSpeed",
    "Camera & Navigation",
    "Rotate speed",
    1,
    0.1,
    5,
    0.1,
  ),
  n("camera.panSpeed", "Camera & Navigation", "Pan speed", 1, 0.1, 5, 0.1),
  n("camera.zoomSpeed", "Camera & Navigation", "Zoom speed", 1, 0.1, 5, 0.1),
  b("camera.autoRotate", "Camera & Navigation", "Auto rotate", false),
  n(
    "camera.autoRotateSpeed",
    "Camera & Navigation",
    "Auto rotate speed",
    2,
    -10,
    10,
    0.1,
  ),
  b(
    "camera.showViewportControls",
    "Camera & Navigation",
    "Show viewport camera controls",
    true,
  ),
  b(
    "camera.dof.enabled",
    "Camera & Navigation",
    "Depth of Field enabled",
    false,
    "scene-object",
  ),
  s(
    "camera.dof.quality",
    "Camera & Navigation",
    "Depth of Field quality",
    "Medium",
    ["Low", "Medium", "High"],
    "renderer-recreation",
  ),
  s(
    "camera.dof.focusMode",
    "Camera & Navigation",
    "Focus mode",
    "Manual distance",
    [
      "Manual distance",
      "Selected Entity",
      "Selected Entity's cluster",
      "Nearest rendered entity",
      "Largest visible cluster",
    ],
  ),
  n(
    "camera.dof.focusDistance",
    "Camera & Navigation",
    "Distance where the view is sharp",
    30,
    0.001,
    100000,
    0.1,
  ),
  n(
    "camera.dof.focusRange",
    "Camera & Navigation",
    "Depth range that remains sharp",
    12,
    0,
    100000,
    0.1,
  ),
  n(
    "camera.dof.blurAmount",
    "Camera & Navigation",
    "Amount of out-of-focus blur",
    2,
    0,
    100,
    0.01,
  ),
  n(
    "camera.dof.bokehSize",
    "Camera & Navigation",
    "Size of out-of-focus highlights",
    2,
    0,
    100,
    0.01,
  ),
  n(
    "camera.dof.nearStrength",
    "Camera & Navigation",
    "Blur strength for objects nearer than focus",
    1,
    0,
    10,
    0.01,
  ),
  n(
    "camera.dof.farStrength",
    "Camera & Navigation",
    "Blur strength for objects farther than focus",
    1,
    0,
    10,
    0.01,
  ),
  n(
    "camera.dof.transitionSoftness",
    "Camera & Navigation",
    "Softness of the focus transition",
    1,
    0,
    100,
    0.01,
  ),
  n(
    "camera.dof.maxBlur",
    "Camera & Navigation",
    "Maximum blur radius",
    1,
    0,
    1,
    0.01,
  ),
  n(
    "camera.dof.samples",
    "Camera & Navigation",
    "Depth of Field sample quality",
    8,
    1,
    32,
    1,
    "renderer-recreation",
    "high",
  ),
  b("light.ambientEnabled", "Lighting", "Ambient light", true),
  c("light.ambientColor", "Lighting", "Ambient color", "#6688aa"),
  n(
    "light.ambientIntensity",
    "Lighting",
    "Ambient intensity",
    1.3,
    0,
    10,
    0.05,
  ),
  b("light.primaryEnabled", "Lighting", "Primary light", true),
  c("light.primaryColor", "Lighting", "Primary color", "#8bd9ff"),
  n("light.primaryIntensity", "Lighting", "Primary intensity", 45, 0, 200, 1),
  v("light.primaryPosition", "Lighting", "Primary position", [0, 0, 0]),
  b("light.fillEnabled", "Lighting", "Fill light", true),
  c("light.fillColor", "Lighting", "Fill color", "#8055aa"),
  n("light.fillIntensity", "Lighting", "Fill intensity", 12, 0, 100, 1),
  v("light.fillPosition", "Lighting", "Fill position", [-12, 8, 10]),
  n(
    "entity.scale",
    "Entities",
    "Global entity scale",
    1,
    0.1,
    8,
    0.01,
    "scene-object",
  ),
  n(
    "entity.minTraitScale",
    "Entities",
    "Minimum trait scale",
    0.18,
    0.03,
    2,
    0.01,
  ),
  n(
    "entity.maxTraitScale",
    "Entities",
    "Maximum trait scale",
    0.36,
    0.05,
    3,
    0.01,
  ),
  n("entity.brightness", "Entities", "Overall brightness", 1, 0.1, 4, 0.01),
  n("entity.saturation", "Entities", "Saturation", 0.72, 0, 1, 0.01),
  n("entity.lightness", "Entities", "Lightness", 0.55, 0.05, 0.95, 0.01),
  n("entity.opacity", "Entities", "Opacity", 1, 0.05, 1, 0.01),
  n("entity.metalness", "Entities", "Metalness", 0.15, 0, 1, 0.01),
  n("entity.roughness", "Entities", "Roughness", 0.35, 0, 1, 0.01),
  n(
    "entity.emissiveMultiplier",
    "Entities",
    "Emissive multiplier",
    1,
    0,
    8,
    0.01,
  ),
  n(
    "entity.emissiveInfluence",
    "Entities",
    "Emissive color influence",
    0.5,
    0,
    1,
    0.01,
  ),
  n(
    "entity.geometryDetail",
    "Entities",
    "Geometry detail",
    1,
    0,
    3,
    1,
    "geometry-rebuild",
    "high",
  ),
  n(
    "entity.orientationInfluence",
    "Entities",
    "Orientation influence",
    1,
    0,
    1,
    0.01,
    "scene-object",
  ),
  n(
    "entity.genesisMultiplier",
    "Entities",
    "Genesis scale multiplier",
    1.45,
    0.25,
    4,
    0.01,
    "scene-object",
  ),
  n(
    "entity.injectionMultiplier",
    "Entities",
    "Injection scale multiplier",
    1,
    0.25,
    4,
    0.01,
    "scene-object",
  ),
  n(
    "entity.condensationMultiplier",
    "Entities",
    "Condensation scale multiplier",
    1.3,
    0.25,
    4,
    0.01,
    "scene-object",
  ),
  n(
    "entity.contextAccent",
    "Entities",
    "Context accent strength",
    0.45,
    0,
    2,
    0.01,
  ),
  n(
    "entity.clusterAccent",
    "Entities",
    "Cluster accent strength",
    0.45,
    0,
    2,
    0.01,
  ),
  b("entity.idlePulse", "Entities", "Idle pulse", false),
  n(
    "entity.idlePulseAmount",
    "Entities",
    "Idle pulse amount",
    0.05,
    0,
    0.5,
    0.01,
  ),
  n("entity.idlePulseSpeed", "Entities", "Idle pulse speed", 1, 0.1, 10, 0.1),
  c("relationship.positiveColor", "Relationships", "Positive color", "#52d8ff"),
  c("relationship.negativeColor", "Relationships", "Negative color", "#ff4f9b"),
  n(
    "relationship.weakOpacity",
    "Relationships",
    "Weak bond opacity",
    0.22,
    0,
    1,
    0.01,
  ),
  n(
    "relationship.activeOpacity",
    "Relationships",
    "Active bond opacity",
    0.72,
    0,
    1,
    0.01,
  ),
  n(
    "relationship.minRadius",
    "Relationships",
    "Minimum cylinder radius",
    0.014,
    0.002,
    0.2,
    0.001,
    "geometry-rebuild",
    "medium",
  ),
  n(
    "relationship.maxRadius",
    "Relationships",
    "Maximum cylinder radius",
    0.035,
    0.002,
    0.3,
    0.001,
    "geometry-rebuild",
    "medium",
  ),
  n(
    "relationship.activeThickness",
    "Relationships",
    "Active thickness multiplier",
    1,
    1,
    6,
    0.1,
    "geometry-rebuild",
    "medium",
  ),
  n(
    "relationship.eventBrightness",
    "Relationships",
    "Event pulse brightness",
    0.9,
    0.1,
    3,
    0.01,
  ),
  n(
    "relationship.eventScale",
    "Relationships",
    "Event pulse scale",
    2,
    0.1,
    8,
    0.1,
  ),
  n(
    "relationship.eventDuration",
    "Relationships",
    "Event persistence duration",
    2.5,
    0.1,
    10,
    0.1,
  ),
  n(
    "relationship.ghostDuration",
    "Relationships",
    "Dissolved ghost duration",
    2.5,
    0.1,
    10,
    0.1,
  ),
  n(
    "relationship.ghostOpacity",
    "Relationships",
    "Dissolved ghost opacity",
    0.9,
    0,
    1,
    0.01,
  ),
  n(
    "relationship.pulseSpeed",
    "Relationships",
    "Relationship pulse speed",
    1,
    0.1,
    10,
    0.1,
  ),
  b("cluster.enabled", "Clusters & Contexts", "Cluster accents", true),
  c("cluster.color", "Clusters & Contexts", "Cluster color", "#58cbe8"),
  n(
    "cluster.opacity",
    "Clusters & Contexts",
    "Cluster opacity",
    0.1,
    0,
    1,
    0.01,
  ),
  n(
    "cluster.scale",
    "Clusters & Contexts",
    "Cluster accent scale",
    1,
    0.25,
    3,
    0.01,
  ),
  b("context.enabled", "Clusters & Contexts", "Context accents", true),
  n(
    "context.colorInfluence",
    "Clusters & Contexts",
    "Context color influence",
    1,
    0,
    1,
    0.01,
  ),
  n(
    "context.opacity",
    "Clusters & Contexts",
    "Context opacity",
    0.45,
    0,
    1,
    0.01,
  ),
  n("context.scale", "Clusters & Contexts", "Context scale", 1, 0.25, 3, 0.01),
  c(
    "condensation.color",
    "Clusters & Contexts",
    "Condensation accent color",
    "#ffd37a",
  ),
  n(
    "condensation.pulseIntensity",
    "Clusters & Contexts",
    "Condensation pulse intensity",
    1,
    0,
    4,
    0.01,
  ),
  c("selection.color", "Selection", "Highlight color", "#ffffff"),
  n("selection.scale", "Selection", "Highlight scale", 1, 0.5, 4, 0.01),
  b("selection.pulse", "Selection", "Highlight pulse", true),
  n(
    "selection.pulseSpeed",
    "Selection",
    "Highlight pulse speed",
    1,
    0.1,
    10,
    0.1,
  ),
  n(
    "selection.dimUnselected",
    "Selection",
    "Dim unselected amount",
    0,
    0,
    0.9,
    0.01,
  ),
  n(
    "selection.bondEmphasis",
    "Selection",
    "Selected bond emphasis",
    1,
    1,
    5,
    0.1,
  ),
  n(
    "performance.observationHz",
    "Observation & Performance",
    "Observation refresh rate",
    4,
    1,
    10,
    1,
    "scene-object",
  ),
  n(
    "performance.maxGhosts",
    "Observation & Performance",
    "Maximum rendered event ghosts",
    128,
    0,
    1024,
    1,
    "scene-object",
    "medium",
  ),
  n(
    "performance.eventCap",
    "Observation & Performance",
    "Event visual cap",
    512,
    16,
    4096,
    16,
    "scene-object",
    "medium",
  ),
  b(
    "performance.showFps",
    "Observation & Performance",
    "Render FPS display",
    true,
  ),
  s(
    "scene.fogType",
    "Scene",
    "Way fog fills the observed world",
    "exponential",
    ["none", "exponential", "linear"],
  ),
  n(
    "scene.fogNear",
    "Scene",
    "Distance where linear fog begins",
    18,
    0.001,
    100000,
    0.1,
  ),
  n(
    "scene.fogFar",
    "Scene",
    "Distance where linear fog becomes opaque",
    120,
    0.002,
    1000000,
    1,
  ),
  v(
    "scene.worldRotation",
    "Scene",
    "Rotation of the observed universe",
    [0, 0, 0],
  ),
  v(
    "scene.originOffset",
    "Scene",
    "Visual offset of the universe origin",
    [0, 0, 0],
  ),
  n(
    "scene.gridHeight",
    "Scene",
    "Height of the reference grid",
    -12,
    -10000,
    10000,
    0.1,
    "scene-object",
  ),
  v("scene.gridRotation", "Scene", "Rotation of the reference grid", [0, 0, 0]),
  v(
    "entity.scaleAxes",
    "Entities",
    "Shape stretch applied to rendered entities",
    [1, 1, 1],
  ),
  b(
    "entity.wireframe",
    "Entities",
    "Wireframe surfaces on entities",
    false,
    "immediate",
  ),
  b(
    "entity.depthTest",
    "Entities",
    "Entity occlusion by nearer objects",
    true,
    "immediate",
    true,
  ),
  b(
    "entity.depthWrite",
    "Entities",
    "Entities writing into the depth buffer",
    true,
    "immediate",
    true,
  ),
  n(
    "entity.minHashSmoothness",
    "Entities",
    "Minimum hash-derived entity smoothness",
    0,
    0,
    5,
    1,
    "geometry-rebuild",
    "high",
  ),
  n(
    "entity.maxHashSmoothness",
    "Entities",
    "Maximum hash-derived entity smoothness",
    3,
    0,
    5,
    1,
    "geometry-rebuild",
    "high",
  ),
  n(
    "entity.hashSmoothnessStrength",
    "Entities",
    "Strength of hash-derived smoothness variation",
    1,
    0,
    1,
    0.01,
    "geometry-rebuild",
    "high",
  ),
  n(
    "relationship.radialSegments",
    "Relationships",
    "Roundness of rendered relationship lines",
    6,
    3,
    128,
    1,
    "geometry-rebuild",
    "high",
    true,
  ),
  b(
    "relationship.depthTest",
    "Relationships",
    "Relationship occlusion by nearer objects",
    true,
    "immediate",
    true,
  ),
  n(
    "relationship.repulsionOpacity",
    "Relationships",
    "Opacity of active repulsion lines",
    0.72,
    0,
    1,
    0.01,
  ),
  n(
    "relationship.repulsionThickness",
    "Relationships",
    "Extra thickness of active repulsion lines",
    1,
    0,
    20,
    0.1,
    "geometry-rebuild",
    "medium",
  ),
  b(
    "cluster.wireframe",
    "Clusters & Contexts",
    "Wireframe cluster shells",
    true,
    "geometry-rebuild",
  ),
  n(
    "cluster.segments",
    "Clusters & Contexts",
    "Smoothness of cluster shells",
    16,
    4,
    128,
    1,
    "geometry-rebuild",
    "high",
    true,
  ),
  n(
    "context.thickness",
    "Clusters & Contexts",
    "Thickness of rendered context rings",
    0.012,
    0.0001,
    100,
    0.001,
    "geometry-rebuild",
    "medium",
  ),
  n(
    "context.segments",
    "Clusters & Contexts",
    "Smoothness of rendered context rings",
    24,
    3,
    256,
    1,
    "geometry-rebuild",
    "high",
    true,
  ),
  n(
    "selection.opacity",
    "Selection",
    "Opacity of the selected-entity highlight",
    0.75,
    0,
    1,
    0.01,
  ),
  b(
    "vfx.bloom.enabled",
    "VFX",
    "Bloom visible across the observed world",
    false,
    "scene-object",
  ),
  s(
    "vfx.bloom.quality",
    "VFX",
    "Bloom rendering quality",
    "Medium",
    ["Low", "Medium", "High"],
    "renderer-recreation",
  ),
  n(
    "vfx.bloom.strength",
    "VFX",
    "Strength of light spreading beyond bright objects",
    1,
    0,
    8,
    0.05,
  ),
  n(
    "vfx.bloom.radius",
    "VFX",
    "Radius of the rendered bloom halo",
    0.12,
    0,
    1,
    0.01,
  ),
  n(
    "vfx.bloom.threshold",
    "VFX",
    "Brightness required before bloom appears",
    0.72,
    0,
    1,
    0.01,
  ),
  b(
    "vfx.selective.enabled",
    "VFX",
    "Deterministic bloom on targeted universe observations",
    false,
    "scene-object",
  ),
  s(
    "vfx.selective.quality",
    "VFX",
    "Selective bloom rendering quality",
    "Medium",
    ["Low", "Medium", "High"],
    "renderer-recreation",
  ),
  s(
    "vfx.selective.target",
    "VFX",
    "Observed objects receiving deterministic bloom",
    "Entities",
    [
      "Entities",
      "Selected Entity",
      "Positive Bonds",
      "Weak Bonds",
      "Repulsion",
      "Relationships",
      "Clusters",
    ],
  ),
  n(
    "vfx.selective.manualIntensity",
    "VFX",
    "Manual selective bloom intensity",
    1,
    0,
    8,
    0.05,
  ),
  s(
    "vfx.routing.1.driver",
    "VFX",
    "First deterministic quality driving the effect",
    "Entity Hash",
    [
      "Manual",
      "Entity Hash",
      "Context Hash",
      "Pair Hash",
      "Bond Strength",
      "Absolute Bond Strength",
      "Bond Age",
      "Cluster Size",
      "Cluster Age",
      "Cluster Stability",
      "Event Age",
      "Event Type",
      "Dimension",
    ],
  ),
  n(
    "vfx.routing.1.weight",
    "VFX",
    "Influence of the first deterministic driver",
    1,
    0,
    1,
    0.01,
  ),
  n(
    "vfx.routing.1.inputMin",
    "VFX",
    "First driver input mapped to the low output",
    0,
    -10,
    10,
    0.01,
  ),
  n(
    "vfx.routing.1.inputMax",
    "VFX",
    "First driver input mapped to the high output",
    1,
    -10,
    10,
    0.01,
  ),
  n(
    "vfx.routing.1.outputMin",
    "VFX",
    "Lowest bloom intensity from the first driver",
    0,
    0,
    8,
    0.05,
  ),
  n(
    "vfx.routing.1.outputMax",
    "VFX",
    "Highest bloom intensity from the first driver",
    4,
    0,
    8,
    0.05,
  ),
  s(
    "vfx.routing.1.curve",
    "VFX",
    "Shape of the first driver response",
    "linear",
    ["linear", "ease-in", "ease-out", "smoothstep"],
  ),
  b("vfx.routing.1.invert", "VFX", "Reverse the first driver response", false),
  n(
    "vfx.routing.1.quantize",
    "VFX",
    "Number of steps in the first driver response",
    0,
    0,
    64,
    1,
  ),
  s(
    "vfx.routing.2.driver",
    "VFX",
    "Second deterministic quality driving the effect",
    "Manual",
    [
      "Manual",
      "Entity Hash",
      "Context Hash",
      "Pair Hash",
      "Bond Strength",
      "Absolute Bond Strength",
      "Bond Age",
      "Cluster Size",
      "Cluster Age",
      "Cluster Stability",
      "Event Age",
      "Event Type",
      "Dimension",
    ],
  ),
  n(
    "vfx.routing.2.weight",
    "VFX",
    "Influence of the second deterministic driver",
    0,
    0,
    1,
    0.01,
  ),
  n(
    "vfx.routing.2.inputMin",
    "VFX",
    "Second driver input mapped to the low output",
    0,
    -10,
    10,
    0.01,
  ),
  n(
    "vfx.routing.2.inputMax",
    "VFX",
    "Second driver input mapped to the high output",
    1,
    -10,
    10,
    0.01,
  ),
  n(
    "vfx.routing.2.outputMin",
    "VFX",
    "Lowest bloom intensity from the second driver",
    0,
    0,
    8,
    0.05,
  ),
  n(
    "vfx.routing.2.outputMax",
    "VFX",
    "Highest bloom intensity from the second driver",
    4,
    0,
    8,
    0.05,
  ),
  s(
    "vfx.routing.2.curve",
    "VFX",
    "Shape of the second driver response",
    "linear",
    ["linear", "ease-in", "ease-out", "smoothstep"],
  ),
  b("vfx.routing.2.invert", "VFX", "Reverse the second driver response", false),
  n(
    "vfx.routing.2.quantize",
    "VFX",
    "Number of steps in the second driver response",
    0,
    0,
    64,
    1,
  ),
  s(
    "vfx.linkedParticles.status",
    "VFX",
    "Linked Particles module status",
    "Unavailable — native WebGPU compute required",
    ["Unavailable — native WebGPU compute required"],
  ),
  s("vfx.capability.backend", "VFX", "Active renderer backend", "WebGL", [
    "WebGL",
  ]),
  s(
    "vfx.capability.postprocessing",
    "VFX",
    "Postprocessing capability",
    "Available",
    ["Available"],
  ),
  s(
    "vfx.capability.compute",
    "VFX",
    "Native compute capability",
    "Unavailable",
    ["Unavailable"],
  ),
];

const labels: Readonly<Record<string, string>> = {
  "scene.background": "Color behind the observed universe",
  "scene.fogEnabled": "Fog visible in the observed world",
  "scene.fogColor": "Color of the world fog",
  "scene.fogDensity": "Thickness of exponential fog",
  "scene.gridEnabled": "Reference grid visible",
  "scene.gridSize": "Rendered width and depth of the grid",
  "scene.gridDivisions": "Number of grid subdivisions",
  "scene.gridPrimary": "Color of primary grid lines",
  "scene.gridSecondary": "Color of secondary grid lines",
  "scene.gridOpacity": "Opacity of the rendered grid",
  "scene.worldSpread": "Distance between hash-derived entity positions",
  "scene.pixelRatioCap": "Maximum display resolution scale",
  "scene.toneMapping": "Mapping from scene light to display color",
  "scene.exposure": "Overall renderer brightness",
  "scene.fogType": "Way fog fills the observed world",
  "scene.fogNear": "Distance where linear fog begins",
  "scene.fogFar": "Distance where linear fog becomes opaque",
  "scene.worldRotation": "Rotation of the observed universe",
  "scene.originOffset": "Visual offset of the universe origin",
  "scene.gridHeight": "Height of the reference grid",
  "scene.gridRotation": "Rotation of the reference grid",
  "camera.fov": "Width of the camera view",
  "camera.near": "Nearest visible distance from the camera",
  "camera.far": "Farthest visible distance from the camera",
  "camera.damping": "Smooth momentum while navigating",
  "camera.dampingFactor": "Amount of navigation smoothing",
  "camera.rotateSpeed": "Speed of orbiting the camera",
  "camera.panSpeed": "Speed of moving the camera sideways",
  "camera.zoomSpeed": "Speed of moving toward or away from the universe",
  "camera.autoRotate": "Automatically orbit the observed universe",
  "camera.autoRotateSpeed": "Speed and direction of automatic orbiting",
  "camera.showViewportControls":
    "Show the compact camera controls beside the viewport orbit toggle",
  "camera.dof.enabled": "Depth of Field visible in the observer",
  "camera.dof.quality": "Quality of the out-of-focus image",
  "camera.dof.focusMode": "What the observer keeps in sharp focus",
  "camera.dof.focusDistance": "Distance from the camera that appears sharp",
  "camera.dof.focusRange": "Depth range around focus that remains sharp",
  "camera.dof.blurAmount": "Strength of blur outside the focused range",
  "camera.dof.bokehSize": "Size of blurred highlights",
  "camera.dof.nearStrength": "Blur strength for nearer objects",
  "camera.dof.farStrength": "Blur strength for farther objects",
  "camera.dof.transitionSoftness": "Softness of the transition into blur",
  "camera.dof.maxBlur": "Maximum visible blur radius",
  "camera.dof.samples": "Quality of the depth blur sampling",
  "light.ambientEnabled": "Ambient illumination visible",
  "light.ambientColor": "Color of ambient illumination",
  "light.ambientIntensity": "Brightness of ambient illumination",
  "light.primaryEnabled": "Primary point light visible",
  "light.primaryColor": "Color of the primary point light",
  "light.primaryIntensity": "Brightness of the primary point light",
  "light.primaryPosition": "Position of the primary point light",
  "light.fillEnabled": "Secondary fill light visible",
  "light.fillColor": "Color of the secondary fill light",
  "light.fillIntensity": "Brightness of the secondary fill light",
  "light.fillPosition": "Position of the secondary fill light",
  "entity.scale": "Rendered size of every entity",
  "entity.minTraitScale": "Smallest hash-derived entity size",
  "entity.maxTraitScale": "Largest hash-derived entity size",
  "entity.brightness": "Brightness of rendered entity surfaces",
  "entity.saturation": "Color saturation of entities",
  "entity.lightness": "Color lightness of entities",
  "entity.opacity": "Transparency of rendered entities",
  "entity.metalness": "Metal-like reflection of entity surfaces",
  "entity.roughness": "Softness of reflections on entity surfaces",
  "entity.emissiveMultiplier": "Amount entities appear to glow",
  "entity.emissiveInfluence": "Influence of hash-derived glow color",
  "entity.geometryDetail": "Geometric smoothness of entity shapes",
  "entity.orientationInfluence": "Influence of hash-derived orientation",
  "entity.genesisMultiplier": "Relative size of genesis entities",
  "entity.injectionMultiplier": "Relative size of injected entities",
  "entity.condensationMultiplier": "Relative size of condensed entities",
  "entity.contextAccent": "Strength of context color on entities",
  "entity.clusterAccent": "Strength of cluster color on entities",
  "entity.idlePulse": "Gentle pulsing while entities are idle",
  "entity.idlePulseAmount": "Amount entity glow changes during idle pulsing",
  "entity.idlePulseSpeed": "Speed of idle entity pulsing",
  "entity.scaleAxes": "Stretch of entity shapes along each axis",
  "entity.wireframe": "Show entity surfaces as wireframes",
  "entity.depthTest": "Allow nearer objects to hide entities",
  "entity.depthWrite": "Allow entities to hide objects behind them",
  "relationship.positiveColor": "Color of rendered positive relationships",
  "relationship.negativeColor": "Color of rendered repulsion",
  "relationship.weakOpacity": "Opacity of lines representing weak bonds",
  "relationship.activeOpacity":
    "Opacity of lines representing active relationships",
  "relationship.minRadius": "Thickness of the weakest relationship lines",
  "relationship.maxRadius": "Thickness of the strongest relationship lines",
  "relationship.activeThickness": "Extra thickness for active relationships",
  "relationship.eventBrightness": "Glow of newly observed relationship events",
  "relationship.eventScale": "Visual expansion of relationship event pulses",
  "relationship.eventDuration":
    "How long new relationship events remain visible",
  "relationship.ghostDuration":
    "How long dissolved relationships leave a trace",
  "relationship.ghostOpacity": "Opacity of dissolved relationship traces",
  "relationship.pulseSpeed": "Speed of relationship event pulsing",
  "relationship.radialSegments": "Roundness of rendered relationship lines",
  "relationship.depthTest": "Allow nearer objects to hide relationship lines",
  "cluster.enabled": "Cluster boundary shells visible",
  "cluster.color": "Color of cluster boundary shells",
  "cluster.opacity": "Opacity of cluster boundary shells",
  "cluster.scale": "Size exaggeration of cluster boundaries",
  "cluster.wireframe": "Show cluster boundaries as wireframes",
  "cluster.segments": "Smoothness of cluster boundary shells",
  "context.enabled": "Context rings visible",
  "context.colorInfluence": "Strength of context-derived ring color",
  "context.opacity": "Opacity of rendered context rings",
  "context.scale": "Size exaggeration of context rings",
  "context.thickness": "Thickness of rendered context rings",
  "context.segments": "Smoothness of rendered context rings",
  "condensation.color": "Color used to mark condensed entities",
  "condensation.pulseIntensity": "Brightness of condensation formation pulses",
  "selection.color": "Color surrounding the selected entity",
  "selection.scale": "Size of the selected-entity highlight",
  "selection.pulse": "Pulse the selected-entity highlight",
  "selection.pulseSpeed": "Speed of the selected-entity pulse",
  "selection.dimUnselected": "How much unselected entities are darkened",
  "selection.bondEmphasis":
    "Brightness of relationships touching the selection",
  "selection.opacity": "Opacity of the selected-entity highlight",
  "performance.observationHz": "Times per second observation state is sampled",
  "performance.maxGhosts": "Maximum dissolved-event traces kept visible",
  "performance.eventCap": "Maximum simultaneous event visuals",
  "performance.showFps": "Show render frame-rate telemetry",
};
const category = (
  id: string,
): { category: string; categoryOrder: number; subcategory?: string } => {
  if (id.startsWith("palette."))
    return {
      category: "Color Palette",
      categoryOrder: 10,
      subcategory: "Palette Library",
    };
  if (id.startsWith("vfx.")) {
    let sub = "Performance / Capabilities";
    if (id.startsWith("vfx.routing")) sub = "VFX Routing";
    else if (id.startsWith("vfx.bloom")) sub = "Bloom";
    else if (id.startsWith("vfx.selective")) sub = "Selective Bloom";
    else if (id.startsWith("vfx.dof")) sub = "Depth of Field";
    else if (id.startsWith("vfx.radialBlur")) sub = "Radial Blur";
    else if (id.startsWith("vfx.particleField")) sub = "Particle Field";
    else if (id.startsWith("vfx.linkedParticles")) sub = "Linked Particles";
    else if (id.startsWith("vfx.vortexField")) sub = "Vortex Field";
    return {
      category: "Deterministic VFX",
      categoryOrder: 90,
      subcategory: sub,
    };
  }
  if (id.startsWith("scene.grid"))
    return {
      category: "World / Environment",
      categoryOrder: 20,
      subcategory: "Grid",
    };
  if (id.startsWith("scene."))
    return {
      category: "World / Environment",
      categoryOrder: 20,
      subcategory: "World / Renderer",
    };
  if (id.startsWith("camera.dof."))
    return {
      category: "Camera",
      categoryOrder: 20,
      subcategory: "Depth of Field",
    };
  if (id.startsWith("camera."))
    return {
      category: "Camera",
      categoryOrder: 20,
      subcategory:
        id === "camera.showViewportControls"
          ? "Viewport Controls"
          : "Navigation / Projection",
    };
  if (id.startsWith("light."))
    return {
      category: "World / Environment",
      categoryOrder: 20,
      subcategory: "Lighting",
    };
  if (id.startsWith("entity.")) {
    const form = [
      "entity.scale",
      "entity.scaleAxes",
      "entity.orientationInfluence",
      "entity.minTraitScale",
      "entity.maxTraitScale",
    ].includes(id);
    return {
      category: "Entities",
      categoryOrder: 30,
      subcategory:
        id.includes("Smoothness") || id === "entity.geometryDetail"
          ? "Hash-derived appearance"
          : id.includes("idlePulse")
            ? "Temporal appearance"
            : id.includes("genesis") ||
                id.includes("injection") ||
                id.includes("condensation")
              ? "Provenance sizing"
              : form
                ? "Form"
                : "Surface",
    };
  }
  if (id.startsWith("relationship.")) {
    const temporal =
      id.includes("event") || id.includes("ghost") || id.includes("pulse");
    const repulsion =
      id === "relationship.negativeColor" || id.includes("repulsion");
    const weak = id.includes("weak");
    const shared = [
      "relationship.minRadius",
      "relationship.maxRadius",
      "relationship.radialSegments",
      "relationship.depthTest",
    ].includes(id);
    return {
      category: "Relationships",
      categoryOrder: 40,
      subcategory: temporal
        ? "Temporal / Pulse Behavior"
        : repulsion
          ? "Repulsion"
          : weak
            ? "Weak / Developing Bonds"
            : shared
              ? "Shared Geometry"
              : "Positive / Active Bonds",
    };
  }
  if (id.startsWith("cluster."))
    return { category: "Clusters", categoryOrder: 50 };
  if (id.startsWith("context."))
    return { category: "Contexts", categoryOrder: 60 };
  if (id.startsWith("selection."))
    return { category: "Selection", categoryOrder: 70 };
  if (id.startsWith("condensation."))
    return { category: "Events / Persistence", categoryOrder: 80 };
  return { category: "Performance / Observation", categoryOrder: 100 };
};
const sliderRange = (
  definition: RawParameter,
): Pick<VisualParameterDefinition, "sliderMin" | "sliderMax"> =>
  definition.type === "number"
    ? { sliderMin: definition.min, sliderMax: definition.max }
    : {};
const refinedLabels: Readonly<Record<string, string>> = {
  "relationship.activeThickness":
    "Thickness multiplier for rendered active positive bond lines",
  "relationship.activeOpacity":
    "Opacity of rendered active positive bond lines",
  "relationship.weakOpacity":
    "Opacity of rendered weak or developing relationship lines",
  "relationship.repulsionOpacity":
    "Opacity of rendered active repulsion geometry",
  "relationship.repulsionThickness":
    "Thickness multiplier for rendered active repulsion geometry",
  "relationship.radialSegments": "Roundness of rendered relationship lines",
};
const unitBounded = (id: string) =>
  /(opacity|saturation|lightness|metalness|roughness|Influence|dimUnselected)$/i.test(
    id,
  );
const integerIds = new Set([
  "scene.gridDivisions",
  "entity.geometryDetail",
  "relationship.radialSegments",
  "cluster.segments",
  "context.segments",
  "performance.maxGhosts",
  "performance.eventCap",
  "vfx.routing.1.quantize",
  "vfx.routing.2.quantize",
]);
const technicalBounds = (
  definition: RawParameter,
): Partial<VisualParameterDefinition> => {
  if (definition.type !== "number") return {};
  if (unitBounded(definition.id)) return { min: 0, max: 1 };
  if (
    definition.id === "camera.near" ||
    definition.id === "camera.far" ||
    definition.id === "scene.fogNear" ||
    definition.id === "scene.fogFar"
  )
    return { min: 0.000001, max: 1_000_000_000 };
  if (definition.id === "camera.fov") return { min: 0.001, max: 179.999 };
  if (definition.id === "scene.pixelRatioCap") return { min: 0.1, max: 8 };
  if (definition.id === "performance.observationHz")
    return { min: 0.5, max: 30 };
  if (
    definition.id === "relationship.eventDuration" ||
    definition.id === "relationship.ghostDuration"
  )
    return { min: 0.001, max: undefined };
  if (definition.id === "entity.geometryDetail")
    return { min: 0, max: 5, integer: true };
  if (
    definition.id === "entity.minHashSmoothness" ||
    definition.id === "entity.maxHashSmoothness"
  )
    return { min: 0, max: 5, integer: true };
  if (definition.id === "entity.hashSmoothnessStrength")
    return { min: 0, max: 1 };
  if (definition.id === "scene.gridDivisions")
    return { min: 1, max: 2000, integer: true };
  if (definition.id === "relationship.radialSegments")
    return { min: 3, max: 128, integer: true };
  if (definition.id === "cluster.segments")
    return { min: 4, max: 256, integer: true };
  if (definition.id === "context.segments")
    return { min: 3, max: 512, integer: true };
  if (
    definition.id === "performance.maxGhosts" ||
    definition.id === "performance.eventCap"
  )
    return { min: 0, max: 10000, integer: true };
  if (definition.min !== undefined && definition.min >= 0)
    return { min: 0, max: undefined, integer: integerIds.has(definition.id) };
  return {
    min: undefined,
    max: undefined,
    integer: integerIds.has(definition.id),
  };
};
const activePaletteParameter: VisualParameterDefinition = {
  id: "palette.active",
  group: "Color Palette",
  category: "Color Palette",
  subcategory: "Palette Library",
  categoryOrder: 10,
  label: "Active palette",
  description: "Stable palette ID used by every observer color resolver.",
  type: "palette-id",
  defaultValue: "hru-default",
  updateMode: "scene-object",
  performanceCost: "low",
  advanced: false,
};
export const visualParameters: readonly VisualParameterDefinition[] = [
  ...rawVisualParameters
    .filter((definition) => definition.id !== "palette.active")
    .map((definition) =>
      Object.freeze({
        ...definition,
        ...technicalBounds(definition),
        ...category(definition.id),
        ...sliderRange(definition),
        label:
          refinedLabels[definition.id] ??
          labels[definition.id] ??
          definition.label,
      }),
    ),
  Object.freeze(activePaletteParameter),
  ...particleFieldParameters.map((definition) => Object.freeze(definition)),
  ...vortexFieldParameters.map((definition) => Object.freeze(definition)),
  ...radialBlurParameters.map((definition) => Object.freeze(definition)),
];
export const visualRegistry = new TypedVisualParameterRegistry(
  visualParameters,
);
export function normalizeVisualConfiguration(
  values: Readonly<Record<string, VisualValue>>,
  registry = visualRegistry,
): VisualConfiguration {
  const keys = Object.keys(values);
  for (const key of keys) registry.get(key);
  const defaults = registry.defaults();
  const normalized = Object.fromEntries(
    registry
      .list()
      .map((definition) => [
        definition.id,
        registry.validate(
          definition.id,
          values[definition.id] ?? defaults[definition.id]!,
        ),
      ]),
  );
  if (
    (normalized["camera.near"] as number) >=
    (normalized["camera.far"] as number)
  )
    throw new Error(
      "Nearest visible camera distance must be smaller than the farthest visible distance",
    );
  if (
    (normalized["scene.fogNear"] as number) >=
    (normalized["scene.fogFar"] as number)
  )
    throw new Error(
      "Linear fog start distance must be smaller than its fully opaque distance",
    );
  if (
    (normalized["entity.minTraitScale"] as number) >
    (normalized["entity.maxTraitScale"] as number)
  )
    throw new Error(
      "Smallest hash-derived entity size cannot exceed the largest size",
    );
  if (
    (normalized["entity.minHashSmoothness"] as number) >
    (normalized["entity.maxHashSmoothness"] as number)
  )
    throw new Error(
      "Minimum hash-derived smoothness cannot exceed maximum hash-derived smoothness",
    );
  for (const route of [1, 2])
    if (
      (normalized[`vfx.routing.${route}.inputMin`] as number) ===
      (normalized[`vfx.routing.${route}.inputMax`] as number)
    )
      throw new Error(`VFX routing ${route} input range cannot be zero`);
  if (
    (normalized["vfx.particleField.mapping.inputMin"] as number) ===
    (normalized["vfx.particleField.mapping.inputMax"] as number)
  )
    throw new Error("Particle Field routing input range cannot be zero");
  if (
    (normalized["vfx.particleField.innerRadius"] as number) >
    (normalized["vfx.particleField.radius"] as number)
  )
    throw new Error(
      "Particle Field inner radius cannot exceed its outer radius",
    );
  if (
    (normalized["vfx.particleField.minSize"] as number) >
    (normalized["vfx.particleField.maxSize"] as number)
  )
    throw new Error("Particle Field minimum size cannot exceed maximum size");
  if (
    (normalized["vfx.vortexField.mapping.inputMin"] as number) ===
    (normalized["vfx.vortexField.mapping.inputMax"] as number)
  )
    throw new Error("Vortex Field routing input range cannot be zero");
  if (
    (normalized["vfx.vortexField.innerRadius"] as number) >
    (normalized["vfx.vortexField.radius"] as number)
  )
    throw new Error("Vortex Field inner radius cannot exceed its outer radius");
  return normalized;
}
