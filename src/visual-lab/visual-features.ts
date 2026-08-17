import type {
  VisualConfiguration,
  VisualParameterDefinition,
  VisualUpdateMode,
  VisualValue,
} from "./types";
import { visualRegistry } from "./registry";

export type VisualObjectType =
  | "entity"
  | "positive-relationship"
  | "weak-relationship"
  | "repulsion-relationship"
  | "cluster"
  | "context"
  | "condensed-entity"
  | "event"
  | "particle-field-source"
  | "vortex-field-source"
  | "world";
export type VisualDiagnosticStatus =
  | "ACTIVE"
  | "OFF"
  | "BLOCKED"
  | "NO TARGET"
  | "UNSUPPORTED"
  | "INVISIBLE";
export type ParameterConsumptionStatus = "consumed" | "prepared" | "diagnostic";

export interface VisualFeatureDefinition {
  readonly id: string;
  readonly label: string;
  readonly appliesTo: readonly VisualObjectType[];
  readonly parameterIds: readonly string[];
  readonly dependencies: readonly string[];
  readonly capabilityRequirements: readonly string[];
  readonly consumer: string;
}

export interface VisualParameterCoverage {
  readonly parameterId: string;
  readonly label: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly type: VisualParameterDefinition["type"];
  readonly consumer: string;
  readonly appliesTo: readonly VisualObjectType[];
  readonly status: ParameterConsumptionStatus;
  readonly dependencies: readonly string[];
  readonly capabilityRequirements: readonly string[];
  readonly updateRequirement:
    | "uniform/material update"
    | "scene-object update"
    | "geometry rebuild"
    | "postprocessing rebuild";
  readonly changesEffectiveState: boolean;
  readonly reason?: string;
}

const all = visualRegistry.list();
const ids = (...prefixes: readonly string[]) =>
  all
    .filter(({ id }) => prefixes.some((prefix) => id.startsWith(prefix)))
    .map(({ id }) => id);
const objects = (...values: readonly VisualObjectType[]) => values;

export const visualFeatures: readonly VisualFeatureDefinition[] = [
  {
    id: "palette",
    label: "Palette resolution",
    appliesTo: objects(
      "world",
      "entity",
      "positive-relationship",
      "weak-relationship",
      "repulsion-relationship",
      "cluster",
      "context",
      "condensed-entity",
      "event",
      "particle-field-source",
      "vortex-field-source",
    ),
    parameterIds: ids("palette."),
    dependencies: ["palette.enabled"],
    capabilityRequirements: [],
    consumer: "Color Resolver / material and vertex-color refresh",
  },
  {
    id: "world",
    label: "World and renderer",
    appliesTo: objects("world"),
    parameterIds: [...ids("scene."), ...ids("light."), ...ids("performance.")],
    dependencies: [],
    capabilityRequirements: ["WebGL renderer"],
    consumer: "SceneObserver.applyEnvironment / ThreeObservationRenderer",
  },
  {
    id: "camera",
    label: "Camera and depth of field",
    appliesTo: objects(
      "world",
      "entity",
      "positive-relationship",
      "weak-relationship",
      "repulsion-relationship",
      "cluster",
      "context",
      "condensed-entity",
      "event",
    ),
    parameterIds: ids("camera."),
    dependencies: ["camera.dof.enabled for depth-of-field parameters"],
    capabilityRequirements: ["WebGL postprocessing for depth of field"],
    consumer: "SceneObserver camera / BloomPipeline depth-of-field pass",
  },
  {
    id: "entities",
    label: "Rendered entities",
    appliesTo: objects("entity"),
    parameterIds: ids("entity."),
    dependencies: [],
    capabilityRequirements: ["Instanced mesh rendering"],
    consumer:
      "transformedEntityVisual / ThreeObservationRenderer entity materials and geometry",
  },
  {
    id: "relationships",
    label: "Rendered relationships",
    appliesTo: objects(
      "positive-relationship",
      "weak-relationship",
      "repulsion-relationship",
      "event",
    ),
    parameterIds: ids("relationship."),
    dependencies: ["relationship classification", "render channel visibility"],
    capabilityRequirements: ["Mesh rendering"],
    consumer: "ThreeObservationRenderer relationship geometry and event traces",
  },
  {
    id: "clusters",
    label: "Cluster accents",
    appliesTo: objects("cluster"),
    parameterIds: ids("cluster."),
    dependencies: ["cluster.enabled", "at least one observed cluster"],
    capabilityRequirements: ["Mesh rendering"],
    consumer: "ThreeObservationRenderer cluster shells",
  },
  {
    id: "contexts",
    label: "Context accents",
    appliesTo: objects("context"),
    parameterIds: ids("context."),
    dependencies: ["context.enabled", "non-zero entity context"],
    capabilityRequirements: ["Mesh rendering"],
    consumer: "ThreeObservationRenderer context rings",
  },
  {
    id: "condensation",
    label: "Condensation accents",
    appliesTo: objects("condensed-entity", "event"),
    parameterIds: ids("condensation."),
    dependencies: ["condensation record or event"],
    capabilityRequirements: ["Mesh rendering"],
    consumer: "ThreeObservationRenderer condensation accents and traces",
  },
  {
    id: "selection",
    label: "Observer selection",
    appliesTo: objects(
      "entity",
      "positive-relationship",
      "weak-relationship",
      "repulsion-relationship",
      "cluster",
      "context",
      "condensed-entity",
      "event",
      "particle-field-source",
      "vortex-field-source",
    ),
    parameterIds: ids("selection."),
    dependencies: ["matching visual object selected"],
    capabilityRequirements: ["Raycasting"],
    consumer: "ThreeObservationRenderer selection material",
  },
  {
    id: "bloom",
    label: "Bloom",
    appliesTo: objects(
      "world",
      "entity",
      "positive-relationship",
      "weak-relationship",
      "repulsion-relationship",
      "cluster",
      "context",
      "condensed-entity",
      "event",
      "particle-field-source",
      "vortex-field-source",
    ),
    parameterIds: ids("vfx.bloom."),
    dependencies: ["vfx.bloom.enabled"],
    capabilityRequirements: ["WebGL postprocessing"],
    consumer: "BloomPipeline UnrealBloomPass",
  },
  {
    id: "selective-bloom",
    label: "Selective Bloom",
    appliesTo: objects(
      "entity",
      "positive-relationship",
      "weak-relationship",
      "repulsion-relationship",
      "cluster",
    ),
    parameterIds: [...ids("vfx.selective."), ...ids("vfx.routing.")],
    dependencies: [
      "vfx.selective.enabled",
      "vfx.selective.target match",
      "shared bloom threshold",
      "screen-space contribution",
    ],
    capabilityRequirements: ["WebGL postprocessing"],
    consumer: "selectiveBloomIntensity / targeted materials / BloomPipeline",
  },
  {
    id: "particle-field",
    label: "Particle Field",
    appliesTo: objects(
      "particle-field-source",
      "entity",
      "positive-relationship",
      "weak-relationship",
      "repulsion-relationship",
      "cluster",
      "context",
      "condensed-entity",
      "event",
    ),
    parameterIds: ids("vfx.particleField."),
    dependencies: [
      "vfx.particleField.enabled",
      "vfx.particleField.target has sources",
      "global particle budget",
    ],
    capabilityRequirements: ["WebGL points and shader materials"],
    consumer: "ParticleFieldRenderer",
  },
  {
    id: "vortex-field",
    label: "Vortex Field",
    appliesTo: objects(
      "vortex-field-source",
      "entity",
      "positive-relationship",
      "weak-relationship",
      "repulsion-relationship",
      "cluster",
      "context",
      "condensed-entity",
      "event",
    ),
    parameterIds: ids("vfx.vortexField."),
    dependencies: [
      "vfx.vortexField.enabled",
      "vfx.vortexField.target has sources",
      "maximum active-field budget",
    ],
    capabilityRequirements: ["WebGL line rendering"],
    consumer: "VortexFieldRenderer",
  },
  {
    id: "radial-blur",
    label: "Radial Blur",
    appliesTo: objects("world", "entity", "event"),
    parameterIds: ids("vfx.radialBlur."),
    dependencies: [
      "vfx.radialBlur.enabled",
      "matching event or selected-entity trigger",
    ],
    capabilityRequirements: ["WebGL postprocessing"],
    consumer: "aggregateRadialBlur / RadialBlurPass",
  },
  {
    id: "capability",
    label: "Renderer capability declarations",
    appliesTo: objects("world"),
    parameterIds: [...ids("vfx.capability."), ...ids("vfx.linkedParticles.")],
    dependencies: [],
    capabilityRequirements: [],
    consumer: "Visual Lab capability diagnostics",
  },
] as const;

const preparedIds = new Set([
  "camera.dof.bokehSize",
  "camera.dof.focusRange",
  "camera.dof.nearStrength",
  "camera.dof.farStrength",
  "camera.dof.transitionSoftness",
  "camera.dof.samples",
  "vfx.particleField.clustering",
  "vfx.radialBlur.sourceMode",
  "vfx.radialBlur.updateTicks",
  "vfx.radialBlur.centerFollow",
  "vfx.radialBlur.centerOffsetX",
  "vfx.radialBlur.centerOffsetY",
  "vfx.radialBlur.centerFalloff",
  "vfx.radialBlur.radialExpansion",
  "vfx.radialBlur.radialContraction",
  "vfx.radialBlur.attackTicks",
  "vfx.radialBlur.holdTicks",
  "vfx.radialBlur.decayTicks",
  "vfx.radialBlur.pulseCount",
  "vfx.radialBlur.pulseSpacing",
  "vfx.radialBlur.pulseVariation",
  "vfx.vortexField.innerRadius",
  "vfx.vortexField.width",
  "vfx.vortexField.shellThickness",
  "vfx.vortexField.sourceAligned",
  "vfx.vortexField.radialAlignment",
  "vfx.vortexField.axialStretchX",
  "vfx.vortexField.axialStretchY",
  "vfx.vortexField.axialStretchZ",
  "vfx.vortexField.torsion",
  "vfx.vortexField.radialCompression",
  "vfx.vortexField.radialExpansion",
  "vfx.vortexField.verticalCompression",
  "vfx.vortexField.bend",
  "vfx.vortexField.shear",
  "vfx.vortexField.waveAmplitude",
  "vfx.vortexField.waveFrequency",
  "vfx.vortexField.radialFlow",
  "vfx.vortexField.expansionSpeed",
  "vfx.vortexField.precession",
  "vfx.vortexField.oscillation",
  "vfx.vortexField.thickness",
  "vfx.vortexField.presentation",
  "vfx.vortexField.relationshipExpression",
  "vfx.vortexField.clusterExpression",
]);
const diagnosticIds = new Set([
  "vfx.particleField.status",
  "vfx.vortexField.status",
  "vfx.radialBlur.status",
  "vfx.linkedParticles.status",
  "vfx.capability.backend",
  "vfx.capability.postprocessing",
  "vfx.capability.compute",
]);

const updateRequirement = (
  mode: VisualUpdateMode,
): VisualParameterCoverage["updateRequirement"] =>
  mode === "immediate"
    ? "uniform/material update"
    : mode === "scene-object"
      ? "scene-object update"
      : mode === "geometry-rebuild"
        ? "geometry rebuild"
        : "postprocessing rebuild";

export function visualLabCoverage(): readonly VisualParameterCoverage[] {
  return all.map((parameter) => {
    const feature = visualFeatures.find(({ parameterIds }) =>
      parameterIds.includes(parameter.id),
    );
    if (!feature)
      throw new Error(
        `Visual parameter has no declared consumer: ${parameter.id}`,
      );
    const status: ParameterConsumptionStatus = preparedIds.has(parameter.id)
      ? "prepared"
      : diagnosticIds.has(parameter.id)
        ? "diagnostic"
        : "consumed";
    return {
      parameterId: parameter.id,
      label: parameter.label,
      category: parameter.category,
      ...(parameter.subcategory ? { subcategory: parameter.subcategory } : {}),
      type: parameter.type,
      consumer: feature.consumer,
      appliesTo: feature.appliesTo,
      status,
      dependencies: feature.dependencies,
      capabilityRequirements: feature.capabilityRequirements,
      updateRequirement: updateRequirement(parameter.updateMode),
      changesEffectiveState: status === "consumed",
      ...(status === "prepared"
        ? {
            reason:
              "Prepared control: the current renderer does not consume this value. It is reported explicitly and cannot silently appear active.",
          }
        : {}),
      ...(status === "diagnostic"
        ? {
            reason:
              "Read-only capability/module declaration; it diagnoses renderer state rather than changing appearance.",
          }
        : {}),
    };
  });
}

export function visualLabDiagnostics(values: VisualConfiguration) {
  const coverage = visualLabCoverage();
  return {
    parameterCount: coverage.length,
    consumed: coverage.filter(({ status }) => status === "consumed").length,
    prepared: coverage.filter(({ status }) => status === "prepared").length,
    diagnostic: coverage.filter(({ status }) => status === "diagnostic").length,
    orphanParameterIds: coverage
      .filter(({ consumer }) => !consumer)
      .map(({ parameterId }) => parameterId),
    enabledFeatures: visualFeatures
      .filter((feature) =>
        feature.parameterIds.some((id) => values[id] === true),
      )
      .map(({ id }) => id),
  };
}

export function changedEffectiveFeatureIds(
  before: VisualConfiguration,
  after: VisualConfiguration,
): readonly string[] {
  return visualFeatures
    .filter((feature) =>
      feature.parameterIds.some(
        (id) =>
          before[id] !== after[id] &&
          !preparedIds.has(id) &&
          !diagnosticIds.has(id),
      ),
    )
    .map(({ id }) => id);
}

export function validateVisualFeatureRegistry(): void {
  const registered = new Set(all.map(({ id }) => id));
  for (const feature of visualFeatures)
    for (const id of feature.parameterIds)
      if (!registered.has(id))
        throw new Error(
          `Visual consumer ${feature.id} expects missing parameter: ${id}`,
        );
  for (const parameter of all)
    if (
      !visualFeatures.some(({ parameterIds }) =>
        parameterIds.includes(parameter.id),
      )
    )
      throw new Error(
        `Visual parameter has no declared consumer: ${parameter.id}`,
      );
}

export function parameterWithValue(
  id: string,
  value: VisualValue,
): VisualParameterDefinition {
  visualRegistry.validate(id, value);
  return visualRegistry.get(id);
}
