import * as THREE from "three";
import type {
  ObservationFrame,
  ObservedBond,
  ObservedEntity,
  RelationshipEvent,
} from "./observation-types";
import type { VisualConfiguration } from "../visual-lab/types";
import type { Palette, PaletteRole } from "../visual-lab/palettes";
import {
  deterministicColorFraction,
  paletteById,
  paletteColor,
} from "../visual-lab/palettes";
import { transformedEntityVisual } from "../visual-lab/transform";
import {
  booleanValue,
  numberValue,
  stringValue,
  vectorValue,
} from "../visual-lab/configuration";
import { renderTraits } from "./render-traits";
import {
  selectiveBloomIntensity,
  vfxTargetMatches,
} from "./vfx/postprocessing/selective-bloom";
import type {
  VisualDiagnosticStatus,
  VisualObjectType,
} from "../visual-lab/visual-features";
import {
  diagnoseParticleSource,
  particleSources,
} from "./vfx/procedural/particle-field";
import {
  diagnoseVortexSource,
  vortexSources,
} from "./vfx/procedural/vortex-field";
import type { HashHex } from "../shared/ids";

export interface VisualSelection {
  readonly type: Exclude<VisualObjectType, "world">;
  readonly sourceIdentity: string;
  readonly sourceType: string;
  readonly participants?: readonly string[];
  readonly entityHash?: string;
  readonly transientObjectId?: string;
}

export function sameVisualSelection(
  left: VisualSelection | undefined,
  right: VisualSelection | undefined,
): boolean {
  if (!left || !right) return left === right;
  return (
    left.type === right.type &&
    left.sourceIdentity === right.sourceIdentity &&
    left.entityHash === right.entityHash &&
    left.transientObjectId === right.transientObjectId &&
    (left.participants?.join(":") ?? "") ===
      (right.participants?.join(":") ?? "")
  );
}

export interface EffectiveVisualAttribute {
  readonly id: string;
  readonly label: string;
  readonly rawValue?: unknown;
  readonly effectiveValue: unknown;
  readonly source: string;
  readonly mapping?: string;
  readonly controllingSettingIds: readonly string[];
  readonly status: VisualDiagnosticStatus;
  readonly reason?: string;
}

export interface EffectiveVisualEffect {
  readonly id: string;
  readonly label: string;
  readonly status: VisualDiagnosticStatus;
  readonly summary: string;
  readonly measurements: Readonly<Record<string, string | number | boolean>>;
  readonly reasons: readonly string[];
  readonly controllingSettingIds: readonly string[];
}

export interface VisualWhyChain {
  readonly attribute: string;
  readonly steps: readonly {
    readonly label: string;
    readonly value?: string;
  }[];
}

export interface EffectiveVisualObjectState {
  readonly identity: string;
  readonly type: VisualSelection["type"];
  readonly sourceIdentity: string;
  readonly sourceType: string;
  readonly renderedState: "VISIBLE" | "INVISIBLE" | "NO TARGET";
  readonly attributes: readonly EffectiveVisualAttribute[];
  readonly effects: readonly EffectiveVisualEffect[];
  readonly why: readonly VisualWhyChain[];
  readonly relevantControlIds: readonly string[];
  readonly palette: {
    readonly colorMode: "Legacy Colors" | "Palette";
    readonly activePalette: string;
    readonly activePaletteId: string;
    readonly semanticRole?: PaletteRole;
    readonly sourceFraction?: number;
    readonly palettePosition?: number;
    readonly resolvedColor?: string;
    readonly status: "APPLIED" | "NOT APPLIED";
    readonly reason?: string;
  };
}

export interface VisualResolutionMeasurements {
  readonly cameraDistance?: number;
  readonly projectedDiameterPx?: number;
  readonly rendererSupported?: boolean;
  readonly postprocessingActive?: boolean;
  readonly viewportHeightPx?: number;
}

export interface ResolveVisualObjectOptions {
  readonly palettes?: readonly Palette[];
  readonly events?: readonly RelationshipEvent[];
  readonly measurements?: VisualResolutionMeasurements;
}

const round = (value: number, places = 3) => Number(value.toFixed(places));
const hex = (value: string) => `#${new THREE.Color(value).getHexString()}`;
const relationshipKind = (bond: ObservedBond): VisualSelection["type"] =>
  bond.classification === "active-positive"
    ? "positive-relationship"
    : bond.classification === "active-repulsion"
      ? "repulsion-relationship"
      : "weak-relationship";
const relationshipTarget = (type: VisualSelection["type"]) =>
  type === "positive-relationship"
    ? "Positive Bonds"
    : type === "repulsion-relationship"
      ? "Repulsion"
      : "Weak Bonds";
const relationshipRole = (type: VisualSelection["type"]): PaletteRole =>
  type === "positive-relationship"
    ? "Positive Relationship"
    : type === "repulsion-relationship"
      ? "Repulsion"
      : "Weak Relationship";

export function selectionForEntity(entity: ObservedEntity): VisualSelection {
  return {
    type: "entity",
    sourceIdentity: entity.hash,
    sourceType: "Entity",
    entityHash: entity.hash,
  };
}
export function selectionForBond(bond: ObservedBond): VisualSelection {
  return {
    type: relationshipKind(bond),
    sourceIdentity: bond.pairHash ?? `${bond.low}:${bond.high}`,
    sourceType: bond.classification,
    participants: [bond.low, bond.high],
  };
}

export function resolveEffectiveVisualObject(
  frame: ObservationFrame,
  selection: VisualSelection,
  values: VisualConfiguration,
  options: ResolveVisualObjectOptions = {},
): EffectiveVisualObjectState | undefined {
  if (selection.type === "entity") {
    const entity = frame.entities.find(
      ({ hash }) => hash === selection.sourceIdentity,
    );
    return entity
      ? resolveEntity(entity, selection, frame, values, options)
      : undefined;
  }
  if (
    selection.type === "positive-relationship" ||
    selection.type === "weak-relationship" ||
    selection.type === "repulsion-relationship"
  ) {
    const bond = frame.bonds.find(
      (candidate) =>
        candidate.pairHash === selection.sourceIdentity ||
        (selection.participants?.includes(candidate.low) &&
          selection.participants.includes(candidate.high)),
    );
    return bond
      ? resolveRelationship(bond, selection, frame, values, options)
      : undefined;
  }
  return resolveOther(selection, frame, values, options);
}

function paletteDiagnostic(
  values: VisualConfiguration,
  palettes: readonly Palette[] | undefined,
  role: PaletteRole,
  identity: string,
  channel: string,
  legacy: string,
  measuredFraction?: number,
) {
  const palette = paletteById(String(values["palette.active"]), palettes);
  const sourceFraction =
    measuredFraction ?? deterministicColorFraction(identity, channel);
  let palettePosition =
    values["palette.reverse"] === true ? 1 - sourceFraction : sourceFraction;
  palettePosition =
    (palettePosition + numberValue(values, "palette.offset")) % 1;
  if (palettePosition < 0) palettePosition += 1;
  const quantize = numberValue(values, "palette.quantize");
  if (quantize > 1)
    palettePosition =
      Math.round(palettePosition * (quantize - 1)) / (quantize - 1);
  const applied = values["palette.enabled"] === true;
  const resolvedColor = paletteColor(
    values,
    role,
    sourceFraction,
    legacy,
    palettes,
  );
  return {
    colorMode: applied ? ("Palette" as const) : ("Legacy Colors" as const),
    activePalette: palette.name,
    activePaletteId: palette.id,
    semanticRole: role,
    sourceFraction,
    palettePosition,
    resolvedColor,
    status: applied ? ("APPLIED" as const) : ("NOT APPLIED" as const),
    ...(!applied ? { reason: "Color Mode is Legacy Colors" } : {}),
  };
}

function resolveEntity(
  entity: ObservedEntity,
  selection: VisualSelection,
  frame: ObservationFrame,
  values: VisualConfiguration,
  options: ResolveVisualObjectOptions,
): EffectiveVisualObjectState {
  const visual = transformedEntityVisual(entity, values, options.palettes);
  const traits = renderTraits(
    entity.hash,
    entity.provenance,
    entity.contextHash,
    Boolean(entity.clusterHash),
  );
  const renderedPosition = new THREE.Vector3(
    visual.position.x,
    visual.position.y,
    visual.position.z,
  )
    .applyEuler(new THREE.Euler(...vectorValue(values, "scene.worldRotation")))
    .add(new THREE.Vector3(...vectorValue(values, "scene.originOffset")));
  const palette = paletteDiagnostic(
    values,
    options.palettes,
    "Entity",
    entity.hash,
    "entity/base",
    visual.finalColor,
  );
  const context = {
    entityHash: entity.hash,
    contextHash: entity.contextHash,
    dimension: "dimension-0",
  };
  const selectiveTarget = stringValue(values, "vfx.selective.target"),
    selectiveIntensity = vfxTargetMatches(selectiveTarget, "Entities")
      ? selectiveBloomIntensity(values, context)
      : 0;
  const effectiveEmission = visual.emissive + selectiveIntensity;
  const shape = ["Icosahedron", "Octahedron", "Dodecahedron"][
    traits.geometryVariation
  ]!;
  const attributes: EffectiveVisualAttribute[] = [
    {
      id: "color",
      label: "Color",
      rawValue:
        palette.colorMode === "Palette"
          ? palette.sourceFraction
          : traits.baseHue,
      effectiveValue: visual.finalColor,
      source:
        palette.colorMode === "Palette"
          ? "entity hash through active palette"
          : "legacy entity hash hue",
      mapping: `${palette.semanticRole} semantic role`,
      controllingSettingIds: [
        "palette.enabled",
        "palette.active",
        "palette.mappingMode",
        "palette.reverse",
        "palette.offset",
        "palette.quantize",
        "entity.saturation",
        "entity.lightness",
        "entity.brightness",
      ],
      status: "ACTIVE",
    },
    {
      id: "size",
      label: "Size",
      rawValue: traits.size,
      effectiveValue: round(visual.size),
      source: "entity hash size and provenance",
      mapping: `global scale × ${numberValue(values, "entity.scale")}`,
      controllingSettingIds: [
        "entity.scale",
        "entity.minTraitScale",
        "entity.maxTraitScale",
        "entity.genesisMultiplier",
        "entity.injectionMultiplier",
        "entity.condensationMultiplier",
        "entity.scaleAxes",
      ],
      status: visual.size > 0 ? "ACTIVE" : "INVISIBLE",
    },
    {
      id: "shape",
      label: "Shape",
      effectiveValue: shape,
      source: "entity hash geometry variation",
      controllingSettingIds: [],
      status: "ACTIVE",
    },
    {
      id: "smoothness",
      label: "Smoothness",
      rawValue: traits.smoothnessUnit,
      effectiveValue: visual.geometryDetail,
      source: "entity hash smoothness fraction",
      mapping: `${numberValue(values, "entity.minHashSmoothness")}–${numberValue(values, "entity.maxHashSmoothness")} detail`,
      controllingSettingIds: [
        "entity.geometryDetail",
        "entity.minHashSmoothness",
        "entity.maxHashSmoothness",
        "entity.hashSmoothnessStrength",
      ],
      status: "ACTIVE",
    },
    {
      id: "opacity",
      label: "Opacity",
      effectiveValue: numberValue(values, "entity.opacity"),
      source: "entity material",
      controllingSettingIds: ["entity.opacity", "selection.dimUnselected"],
      status:
        numberValue(values, "entity.opacity") > 0 ? "ACTIVE" : "INVISIBLE",
    },
    {
      id: "emission",
      label: "Emission / Glow",
      rawValue: traits.emissiveIntensity,
      effectiveValue: round(effectiveEmission),
      source:
        selectiveIntensity > 0
          ? "entity hash emission plus resolved Selective Bloom driver"
          : "entity hash emission",
      mapping: `emission x ${numberValue(values, "entity.emissiveMultiplier")} x brightness ${numberValue(values, "entity.brightness")}`,
      controllingSettingIds: [
        "entity.emissiveMultiplier",
        "entity.emissiveInfluence",
        "entity.brightness",
        "entity.idlePulse",
        "entity.idlePulseAmount",
        "entity.idlePulseSpeed",
        "vfx.selective.enabled",
        "vfx.selective.target",
      ],
      status: effectiveEmission > 0 ? "ACTIVE" : "OFF",
    },
    {
      id: "position",
      label: "Position",
      effectiveValue: `${round(renderedPosition.x)}, ${round(renderedPosition.y)}, ${round(renderedPosition.z)}`,
      source: "dimension-0 hash projection",
      mapping: `world spread ${numberValue(values, "scene.worldSpread")}, rotation, and origin offset`,
      controllingSettingIds: [
        "scene.worldSpread",
        "scene.worldRotation",
        "scene.originOffset",
      ],
      status: "ACTIVE",
    },
  ];
  const effects = effectsFor(
    selection,
    values,
    frame,
    context,
    visual.size *
      Math.max(...(values["entity.scaleAxes"] as readonly number[])),
    options,
  );
  return {
    identity: selection.sourceIdentity,
    type: selection.type,
    sourceIdentity: selection.sourceIdentity,
    sourceType: selection.sourceType,
    renderedState: "VISIBLE",
    attributes,
    effects,
    why: [
      {
        attribute: "COLOR",
        steps: [
          {
            label:
              palette.colorMode === "Palette"
                ? "Entity hash"
                : "Legacy entity hue",
            value:
              palette.colorMode === "Palette"
                ? entity.hash.slice(0, 12)
                : round(traits.baseHue, 5).toString(),
          },
          ...(palette.colorMode === "Palette"
            ? [
                {
                  label: "fraction",
                  value: round(palette.sourceFraction!, 5).toString(),
                },
                { label: `${palette.activePalette} palette` },
                { label: "Entity semantic role" },
              ]
            : []),
          { label: "resolved color", value: visual.finalColor },
        ],
      },
      {
        attribute: "SMOOTHNESS",
        steps: [
          { label: "Entity hash" },
          {
            label: "smoothness fraction",
            value: round(traits.smoothnessUnit, 5).toString(),
          },
          {
            label: "configured detail range",
            value: `${numberValue(values, "entity.minHashSmoothness")}–${numberValue(values, "entity.maxHashSmoothness")}`,
          },
          { label: "geometry detail", value: String(visual.geometryDetail) },
        ],
      },
      {
        attribute: "SIZE",
        steps: [
          { label: "Hash-derived size", value: round(traits.size).toString() },
          { label: `${entity.provenance.origin} provenance` },
          {
            label: "global entity scale",
            value: String(numberValue(values, "entity.scale")),
          },
          { label: "rendered size", value: round(visual.size).toString() },
        ],
      },
      {
        attribute: "GLOW",
        steps: [
          {
            label: "Entity hash emission",
            value: round(traits.emissiveIntensity).toString(),
          },
          {
            label: "Configured emission multiplier",
            value: String(numberValue(values, "entity.emissiveMultiplier")),
          },
          {
            label: "Entity brightness",
            value: String(numberValue(values, "entity.brightness")),
          },
          ...(selectiveIntensity > 0
            ? [
                {
                  label: "Selective Bloom driver composition",
                  value: round(selectiveIntensity).toString(),
                },
              ]
            : []),
          {
            label: "effective material emission",
            value: round(effectiveEmission).toString(),
          },
        ],
      },
    ],
    relevantControlIds: unique(
      attributes
        .flatMap(({ controllingSettingIds }) => controllingSettingIds)
        .concat(
          effects.flatMap(({ controllingSettingIds }) => controllingSettingIds),
        ),
    ),
    palette,
  };
}

function resolveRelationship(
  bond: ObservedBond,
  selection: VisualSelection,
  _frame: ObservationFrame,
  values: VisualConfiguration,
  options: ResolveVisualObjectOptions,
): EffectiveVisualObjectState {
  const active =
    bond.classification === "active-positive" ||
    bond.classification === "active-repulsion";
  const positive = bond.strength >= 0;
  const role = relationshipRole(selection.type);
  const explicit = stringValue(
    values,
    positive ? "relationship.positiveColor" : "relationship.negativeColor",
  );
  const palette = paletteDiagnostic(
    values,
    options.palettes,
    role,
    selection.sourceIdentity,
    "relationship/base",
    explicit,
  );
  const color = hex(palette.resolvedColor!);
  const opacity = active
    ? numberValue(
        values,
        positive
          ? "relationship.activeOpacity"
          : "relationship.repulsionOpacity",
      )
    : numberValue(values, "relationship.weakOpacity");
  const min = numberValue(values, "relationship.minRadius"),
    max = numberValue(values, "relationship.maxRadius");
  const thickness =
    (min + (max - min) * Math.abs(bond.strength)) *
    (active
      ? numberValue(
          values,
          positive
            ? "relationship.activeThickness"
            : "relationship.repulsionThickness",
        )
      : 1);
  const attributes: EffectiveVisualAttribute[] = [
    {
      id: "color",
      label: "Color",
      rawValue: explicit,
      effectiveValue: color,
      source:
        palette.colorMode === "Palette"
          ? "pair hash through active palette"
          : "relationship polarity",
      mapping: `${role} semantic role`,
      controllingSettingIds: [
        "palette.enabled",
        "palette.active",
        "palette.mappingMode",
        "palette.reverse",
        "palette.offset",
        "palette.quantize",
        positive ? "relationship.positiveColor" : "relationship.negativeColor",
      ],
      status: "ACTIVE",
    },
    {
      id: "thickness",
      label: "Thickness",
      rawValue: Math.abs(bond.strength),
      effectiveValue: round(thickness, 4),
      source: "absolute bond strength",
      mapping: `radius range ${min}–${max}`,
      controllingSettingIds: [
        "relationship.minRadius",
        "relationship.maxRadius",
        positive
          ? "relationship.activeThickness"
          : "relationship.repulsionThickness",
        "relationship.radialSegments",
      ],
      status: thickness > 0 ? "ACTIVE" : "INVISIBLE",
    },
    {
      id: "opacity",
      label: "Opacity",
      effectiveValue: opacity,
      source: `${active ? "active" : "weak"} relationship classification`,
      controllingSettingIds: [
        active
          ? positive
            ? "relationship.activeOpacity"
            : "relationship.repulsionOpacity"
          : "relationship.weakOpacity",
      ],
      status: opacity > 0 ? "ACTIVE" : "INVISIBLE",
    },
    {
      id: "strength",
      label: "Strength expression",
      rawValue: bond.strength,
      effectiveValue: round(Math.abs(bond.strength)),
      source: "authoritative observed bond strength",
      controllingSettingIds: [],
      status: "ACTIVE",
    },
    {
      id: "geometry",
      label: "Geometry",
      effectiveValue: `cylinder · ${numberValue(values, "relationship.radialSegments")} radial segments`,
      source: "relationship renderer",
      controllingSettingIds: [
        "relationship.radialSegments",
        "relationship.depthTest",
      ],
      status: "ACTIVE",
    },
  ];
  const context = {
    pairHash: bond.pairHash,
    bondStrength: bond.strength,
    dimension: "dimension-0",
  };
  const effects = effectsFor(
    selection,
    values,
    _frame,
    context,
    thickness,
    options,
  );
  return {
    identity: selection.sourceIdentity,
    type: selection.type,
    sourceIdentity: selection.sourceIdentity,
    sourceType: selection.sourceType,
    renderedState: "VISIBLE",
    attributes,
    effects,
    why: [
      {
        attribute: "COLOR",
        steps: [
          {
            label: "Relationship pair hash",
            value: selection.sourceIdentity.slice(0, 12),
          },
          { label: "polarity", value: positive ? "positive" : "repulsion" },
          ...(palette.colorMode === "Palette"
            ? [
                { label: `${palette.activePalette} palette` },
                { label: `${role} semantic role` },
              ]
            : []),
          { label: "resolved color", value: color },
        ],
      },
      {
        attribute: "THICKNESS",
        steps: [
          {
            label: "absolute bond strength",
            value: round(Math.abs(bond.strength), 5).toString(),
          },
          { label: "configured radius range", value: `${min}–${max}` },
          { label: "effective radius", value: round(thickness, 4).toString() },
        ],
      },
    ],
    relevantControlIds: unique(
      attributes
        .flatMap(({ controllingSettingIds }) => controllingSettingIds)
        .concat(
          effects.flatMap(({ controllingSettingIds }) => controllingSettingIds),
        ),
    ),
    palette,
  };
}

function resolveOther(
  selection: VisualSelection,
  frame: ObservationFrame,
  values: VisualConfiguration,
  options: ResolveVisualObjectOptions,
): EffectiveVisualObjectState | undefined {
  let role: PaletteRole;
  let explicit: string;
  let channel: string;
  let sourceFraction: number | undefined;
  let renderedState: EffectiveVisualObjectState["renderedState"] = "VISIBLE";
  const attributes: EffectiveVisualAttribute[] = [];

  if (selection.type === "cluster") {
    const cluster = frame.clusters.find(
      ({ clusterHash }) => clusterHash === selection.sourceIdentity,
    );
    if (!cluster) return undefined;
    role = "Cluster";
    explicit = stringValue(values, "cluster.color");
    channel = "cluster/shell";
    const points = cluster.memberHashes
      .map((hash) => frame.entities.find((entity) => entity.hash === hash))
      .filter((entity): entity is ObservedEntity => Boolean(entity))
      .map(
        (entity) =>
          transformedEntityVisual(entity, values, options.palettes).position,
      );
    const center = new THREE.Vector3();
    for (const point of points)
      center.add(new THREE.Vector3(point.x, point.y, point.z));
    center.multiplyScalar(1 / points.length);
    const radius =
      (Math.max(
        0.5,
        ...points.map((point) =>
          center.distanceTo(new THREE.Vector3(point.x, point.y, point.z)),
        ),
      ) +
        0.35) *
      numberValue(values, "cluster.scale");
    renderedState =
      booleanValue(values, "cluster.enabled") &&
      numberValue(values, "cluster.opacity") > 0
        ? "VISIBLE"
        : "INVISIBLE";
    attributes.push(
      {
        id: "size",
        label: "Radius",
        effectiveValue: round(radius),
        source: "member positions and cluster extent",
        controllingSettingIds: ["cluster.scale", "scene.worldSpread"],
        status: radius > 0 ? "ACTIVE" : "INVISIBLE",
      },
      {
        id: "opacity",
        label: "Opacity",
        effectiveValue: numberValue(values, "cluster.opacity"),
        source: "cluster shell material",
        controllingSettingIds: ["cluster.enabled", "cluster.opacity"],
        status: renderedState === "VISIBLE" ? "ACTIVE" : "INVISIBLE",
      },
      {
        id: "geometry",
        label: "Geometry",
        effectiveValue: `sphere · ${numberValue(values, "cluster.segments")} segments`,
        source: "cluster shell renderer",
        controllingSettingIds: ["cluster.segments", "cluster.wireframe"],
        status: "ACTIVE",
      },
    );
  } else if (selection.type === "context") {
    const entity = frame.entities.find(
      (candidate) =>
        candidate.contextHash === selection.sourceIdentity &&
        (!selection.entityHash || candidate.hash === selection.entityHash),
    );
    if (!entity) return undefined;
    role = "Context";
    channel = "context/ring";
    const legacy = new THREE.Color().setHSL(
      renderTraits(entity.hash, entity.provenance, entity.contextHash, true)
        .accentHue,
      numberValue(values, "context.colorInfluence"),
      0.6,
    );
    explicit = `#${legacy.getHexString()}`;
    renderedState =
      booleanValue(values, "context.enabled") &&
      numberValue(values, "context.opacity") > 0
        ? "VISIBLE"
        : "INVISIBLE";
    attributes.push(
      {
        id: "thickness",
        label: "Thickness",
        effectiveValue: numberValue(values, "context.thickness"),
        source: "context ring geometry",
        controllingSettingIds: ["context.thickness", "context.scale"],
        status:
          numberValue(values, "context.thickness") > 0 ? "ACTIVE" : "INVISIBLE",
      },
      {
        id: "opacity",
        label: "Opacity",
        effectiveValue: numberValue(values, "context.opacity"),
        source: "context ring material",
        controllingSettingIds: ["context.enabled", "context.opacity"],
        status: renderedState === "VISIBLE" ? "ACTIVE" : "INVISIBLE",
      },
    );
  } else if (selection.type === "condensed-entity") {
    if (
      !frame.condensationRecords.some(
        ({ entityHash }) => entityHash === selection.sourceIdentity,
      )
    )
      return undefined;
    role = "Condensed Entity";
    explicit = stringValue(values, "condensation.color");
    channel = "condensed/accent";
    attributes.push({
      id: "geometry",
      label: "Geometry",
      effectiveValue: "wireframe sphere",
      source: "condensation accent renderer",
      controllingSettingIds: [],
      status: "ACTIVE",
    });
  } else if (selection.type === "event") {
    const event = options.events?.find(
      ({ eventId }) => eventId === selection.sourceIdentity,
    );
    if (!event) return undefined;
    const isCluster = event.type.startsWith("cluster-");
    const isCondensation = event.type === "entity-condensed";
    const isPair =
      !isCluster && !isCondensation && event.participants.length >= 2;
    role = isCondensation ? "Condensed Entity" : "Event";
    explicit = isCluster
      ? stringValue(values, "cluster.color")
      : isPair
        ? stringValue(
            values,
            event.type.includes("negative") || event.type.includes("repulsion")
              ? "relationship.negativeColor"
              : "relationship.positiveColor",
          )
        : isCondensation
          ? stringValue(values, "condensation.color")
          : "#8effc1";
    channel = isCluster
      ? "event/cluster"
      : isPair
        ? "relationship/pulse"
        : "event/accent";
    const duration =
      event.type === "bond-dissolved"
        ? numberValue(values, "relationship.ghostDuration")
        : numberValue(values, "relationship.eventDuration");
    attributes.push(
      {
        id: "geometry",
        label: "Geometry",
        effectiveValue: isPair
          ? "relationship pulse"
          : isCluster
            ? "cluster pulse"
            : "event accent",
        source: "observation event type",
        controllingSettingIds: ["relationship.eventScale"],
        status: "ACTIVE",
      },
      {
        id: "duration",
        label: "Duration",
        effectiveValue: duration,
        source: "observer event persistence",
        controllingSettingIds: [
          event.type === "bond-dissolved"
            ? "relationship.ghostDuration"
            : "relationship.eventDuration",
        ],
        status: duration > 0 ? "ACTIVE" : "INVISIBLE",
      },
    );
  } else if (selection.type === "particle-field-source") {
    const events = visualEvents(options.events);
    const source = particleSources(
      frame,
      events,
      selection.entityHash as HashHex | undefined,
      values,
      options.palettes,
    ).find(({ identity }) => identity === selection.sourceIdentity);
    if (!source) return undefined;
    role = "Particle";
    explicit = source.color;
    channel = "particle/source";
    const colorMode = stringValue(values, "vfx.particleField.colorMode");
    const identity =
      colorMode === "Pair hash"
        ? source.context.pairHash
        : colorMode === "Cluster / Context hash"
          ? (source.context.contextHash ?? source.identity)
          : source.identity;
    sourceFraction =
      Number.parseInt((identity ?? source.identity).slice(0, 8), 16) /
      0xffffffff;
    attributes.push(
      {
        id: "size",
        label: "Size range",
        effectiveValue: `${numberValue(values, "vfx.particleField.minSize")}–${numberValue(values, "vfx.particleField.maxSize")}`,
        source: "particle shader size attributes",
        controllingSettingIds: [
          "vfx.particleField.minSize",
          "vfx.particleField.maxSize",
        ],
        status: "ACTIVE",
      },
      {
        id: "opacity",
        label: "Opacity",
        effectiveValue: numberValue(values, "vfx.particleField.opacity"),
        source: "particle shader uniform",
        controllingSettingIds: ["vfx.particleField.opacity"],
        status:
          numberValue(values, "vfx.particleField.opacity") > 0
            ? "ACTIVE"
            : "INVISIBLE",
      },
    );
  } else {
    const events = visualEvents(options.events);
    const source = vortexSources(
      frame,
      events,
      selection.entityHash as HashHex | undefined,
      values,
      options.palettes,
    ).find(({ identity }) => identity === selection.sourceIdentity);
    if (!source) return undefined;
    role = "Vortex";
    explicit = source.color;
    channel = "vortex/source";
    const colorMode = stringValue(values, "vfx.vortexField.colorMode"),
      identity =
        colorMode === "Pair hash"
          ? source.context.pairHash
          : colorMode === "Context hash"
            ? source.context.contextHash
            : colorMode === "Cluster hash"
              ? source.context.entityHash
              : source.identity;
    sourceFraction =
      Number.parseInt((identity ?? source.identity).slice(0, 8), 16) /
      0xffffffff;
    attributes.push(
      {
        id: "radius",
        label: "Radius",
        effectiveValue: numberValue(values, "vfx.vortexField.radius"),
        source: "vortex geometry mapping",
        controllingSettingIds: ["vfx.vortexField.radius"],
        status:
          numberValue(values, "vfx.vortexField.radius") > 0
            ? "ACTIVE"
            : "INVISIBLE",
      },
      {
        id: "opacity",
        label: "Opacity",
        effectiveValue: numberValue(values, "vfx.vortexField.opacity"),
        source: "vortex line material",
        controllingSettingIds: ["vfx.vortexField.opacity"],
        status:
          numberValue(values, "vfx.vortexField.opacity") > 0
            ? "ACTIVE"
            : "INVISIBLE",
      },
    );
  }

  const palette = paletteDiagnostic(
    values,
    options.palettes,
    role,
    selection.sourceIdentity,
    channel,
    explicit,
    sourceFraction,
  );
  attributes.unshift({
    id: "color",
    label: "Color",
    rawValue: explicit,
    effectiveValue:
      palette.colorMode === "Palette"
        ? palette.resolvedColor!
        : selection.type === "particle-field-source" ||
            selection.type === "vortex-field-source"
          ? "varies deterministically"
          : explicit,
    source:
      palette.colorMode === "Palette"
        ? "source identity through active palette"
        : "legacy renderer mapping",
    mapping: `${role} semantic role`,
    controllingSettingIds: [
      "palette.enabled",
      "palette.active",
      "palette.mappingMode",
      "palette.reverse",
      "palette.offset",
      "palette.quantize",
    ],
    status: "ACTIVE",
  });
  const effects = effectsFor(
    selection,
    values,
    frame,
    { entityHash: selection.entityHash },
    1,
    options,
  );
  const why: VisualWhyChain[] = [
    {
      attribute: "COLOR",
      steps: [
        {
          label: "Source identity",
          value: selection.sourceIdentity.slice(0, 12),
        },
        ...(palette.colorMode === "Palette"
          ? [
              {
                label: "source fraction",
                value: round(palette.sourceFraction!, 5).toString(),
              },
              { label: `${palette.activePalette} palette` },
              { label: `${role} semantic role` },
            ]
          : []),
        {
          label: "resolved color",
          value:
            palette.colorMode === "Palette" ? palette.resolvedColor : explicit,
        },
      ],
    },
  ];
  return {
    identity: selection.sourceIdentity,
    type: selection.type,
    sourceIdentity: selection.sourceIdentity,
    sourceType: selection.sourceType,
    renderedState,
    attributes,
    effects,
    why,
    relevantControlIds: unique(
      attributes
        .flatMap(({ controllingSettingIds }) => controllingSettingIds)
        .concat(
          effects.flatMap(({ controllingSettingIds }) => controllingSettingIds),
        ),
    ),
    palette,
  };
}

function visualEvents(events: readonly RelationshipEvent[] | undefined) {
  return (events ?? []).map((event) => ({ event, observedAt: 0 }));
}

function radialTriggerId(event: RelationshipEvent): string | undefined {
  if (event.type === "positive-bond-created")
    return "vfx.radialBlur.trigger.positiveCreated";
  if (event.type === "negative-bond-created")
    return "vfx.radialBlur.trigger.negativeCreated";
  if (event.type === "bond-dissolved")
    return "vfx.radialBlur.trigger.bondDissolved";
  if (event.type === "entity-condensed")
    return "vfx.radialBlur.trigger.condensation";
  if (event.type.startsWith("cluster-"))
    return "vfx.radialBlur.trigger.clusterEvent";
  return undefined;
}

function effectsFor(
  selection: VisualSelection,
  values: VisualConfiguration,
  frame: ObservationFrame,
  context: Parameters<typeof selectiveBloomIntensity>[1],
  worldRadius: number,
  options: ResolveVisualObjectOptions,
): EffectiveVisualEffect[] {
  const effects: EffectiveVisualEffect[] = [];
  const target = relationshipTarget(selection.type);
  const measurements = options.measurements;
  const selectiveRelevant =
    selection.type === "entity"
      ? vfxTargetMatches(
          stringValue(values, "vfx.selective.target"),
          "Entities",
        ) || stringValue(values, "vfx.selective.target") === "Selected Entity"
      : (selection.type.includes("relationship") &&
          vfxTargetMatches(
            stringValue(values, "vfx.selective.target"),
            target,
          )) ||
        (selection.type === "cluster" &&
          stringValue(values, "vfx.selective.target") === "Clusters");
  if (selectiveRelevant) {
    const enabled = values["vfx.selective.enabled"] === true,
      intensity = enabled ? selectiveBloomIntensity(values, context) : 0,
      supported = measurements?.rendererSupported !== false,
      post = measurements?.postprocessingActive !== false,
      diameter = measurements?.projectedDiameterPx;
    let status: VisualDiagnosticStatus = !enabled
      ? "OFF"
      : !supported
        ? "UNSUPPORTED"
        : !post
          ? "BLOCKED"
          : intensity <= 0
            ? "INVISIBLE"
            : diameter !== undefined && diameter < 1
              ? "INVISIBLE"
              : "ACTIVE";
    const reasons: string[] = [];
    if (!enabled) reasons.push("Selective Bloom module is disabled");
    if (!supported)
      reasons.push("Renderer postprocessing capability is unavailable");
    if (!post) reasons.push("Postprocessing is not active");
    if (enabled && intensity <= 0)
      reasons.push("Resolved driver intensity is zero");
    if (diameter !== undefined && diameter < 1)
      reasons.push(
        `Measured projected diameter is subpixel at ${round(diameter, 2)} px`,
      );
    effects.push({
      id: "selective-bloom",
      label: "Selective Bloom",
      status,
      summary:
        status === "ACTIVE"
          ? "Targeted material luminance is active in the screen-space bloom pass"
          : status === "INVISIBLE"
            ? "No pixel-sized bloom source is currently measurable"
            : (reasons[0] ?? status),
      measurements: {
        enabled,
        targetMatched: true,
        rendererSupported: supported,
        postprocessingActive: post,
        effectiveIntensity: round(intensity),
        bloomThreshold: numberValue(values, "vfx.bloom.threshold"),
        worldRadius: round(worldRadius),
        ...(measurements?.cameraDistance !== undefined
          ? { cameraDistance: round(measurements.cameraDistance) }
          : {}),
        ...(diameter !== undefined
          ? { projectedDiameterPx: round(diameter, 2) }
          : {}),
      },
      reasons,
      controllingSettingIds: [
        "vfx.selective.enabled",
        "vfx.selective.target",
        "vfx.selective.manualIntensity",
        "vfx.routing.1.driver",
        "vfx.routing.1.weight",
        "vfx.routing.1.inputMin",
        "vfx.routing.1.inputMax",
        "vfx.routing.1.outputMin",
        "vfx.routing.1.outputMax",
        "vfx.routing.1.curve",
        "vfx.routing.1.invert",
        "vfx.routing.1.quantize",
        "vfx.routing.2.driver",
        "vfx.routing.2.weight",
        "vfx.routing.2.inputMin",
        "vfx.routing.2.inputMax",
        "vfx.routing.2.outputMin",
        "vfx.routing.2.outputMax",
        "vfx.routing.2.curve",
        "vfx.routing.2.invert",
        "vfx.routing.2.quantize",
        "vfx.bloom.threshold",
        "vfx.bloom.radius",
      ],
    });
  }
  {
    const enabled = values["vfx.bloom.enabled"] === true;
    const supported = measurements?.rendererSupported !== false,
      post = measurements?.postprocessingActive !== false,
      status: VisualDiagnosticStatus = !enabled
        ? "OFF"
        : !supported
          ? "UNSUPPORTED"
          : !post
            ? "BLOCKED"
            : "ACTIVE";
    effects.push({
      id: "bloom",
      label: "Bloom",
      status,
      summary:
        status === "ACTIVE"
          ? "World bloom processes this rendered object"
          : status === "OFF"
            ? "Bloom is disabled"
            : status === "UNSUPPORTED"
              ? "Renderer postprocessing capability is unavailable"
              : "Postprocessing is not active",
      measurements: {
        enabled,
        rendererSupported: supported,
        postprocessingActive: post,
        strength: numberValue(values, "vfx.bloom.strength"),
        threshold: numberValue(values, "vfx.bloom.threshold"),
        radius: numberValue(values, "vfx.bloom.radius"),
      },
      reasons:
        status === "ACTIVE"
          ? []
          : [
              status === "OFF"
                ? "Bloom is disabled"
                : status === "UNSUPPORTED"
                  ? "Renderer postprocessing capability is unavailable"
                  : "Postprocessing is not active",
            ],
      controllingSettingIds: [
        "vfx.bloom.enabled",
        "vfx.bloom.strength",
        "vfx.bloom.threshold",
        "vfx.bloom.radius",
        "vfx.bloom.quality",
      ],
    });
  }

  const events = visualEvents(options.events),
    selected = selection.entityHash as HashHex | undefined;
  const particle = diagnoseParticleSource(
      frame,
      events,
      selected,
      values,
      selection.sourceIdentity,
      options.palettes,
    ),
    particleRelevant =
      particle.sourceRank !== undefined ||
      selection.type === "particle-field-source";
  if (particleRelevant) {
    const enabled = booleanValue(values, "vfx.particleField.enabled");
    let status: VisualDiagnosticStatus = !enabled
      ? "OFF"
      : particle.sourceCount === 0 || particle.sourceRank === undefined
        ? "NO TARGET"
        : particle.budget <= 0
          ? "BLOCKED"
          : particle.requested <= 0
            ? "INVISIBLE"
            : particle.rendered <= 0
              ? "BLOCKED"
              : "ACTIVE";
    const reasons =
      status === "NO TARGET"
        ? ["The configured target has no matching current source"]
        : status === "BLOCKED"
          ? [
              particle.budget <= 0
                ? "Global particle budget is zero"
                : "This source is outside the current deterministic particle allocation",
            ]
          : status === "INVISIBLE"
            ? ["Resolved particle density for this source is zero"]
            : status === "OFF"
              ? ["Particle Field is disabled"]
              : [];
    effects.push({
      id: "particleField",
      label: "Particle Field",
      status,
      summary:
        status === "ACTIVE"
          ? "Particle Field applies to this source"
          : (reasons[0] ?? status),
      measurements: {
        enabled,
        target: stringValue(values, "vfx.particleField.target"),
        matchingSources: particle.sourceCount,
        ...(particle.sourceRank !== undefined
          ? { sourceRank: particle.sourceRank + 1 }
          : {}),
        requestedForSource: particle.requested,
        renderedForSource: particle.rendered,
        globalRequested: particle.globalRequested,
        budget: particle.budget,
      },
      reasons,
      controllingSettingIds: [
        "vfx.particleField.enabled",
        "vfx.particleField.target",
        "vfx.particleField.perTarget",
        "vfx.particleField.globalBudget",
        "vfx.particleField.quality",
      ],
    });
  }
  const vortex = diagnoseVortexSource(
      frame,
      events,
      selected,
      values,
      selection.sourceIdentity,
      options.palettes,
    ),
    vortexRelevant =
      vortex.sourceRank !== undefined ||
      selection.type === "vortex-field-source";
  if (vortexRelevant) {
    const enabled = booleanValue(values, "vfx.vortexField.enabled"),
      status: VisualDiagnosticStatus = !enabled
        ? "OFF"
        : vortex.sourceCount === 0 || vortex.sourceRank === undefined
          ? "NO TARGET"
          : vortex.maximumFields <= 0 || !vortex.active
            ? "BLOCKED"
            : "ACTIVE",
      reasons =
        status === "NO TARGET"
          ? ["The configured target has no matching current source"]
          : status === "BLOCKED"
            ? [
                vortex.maximumFields <= 0
                  ? "Maximum active fields is zero"
                  : `Source rank ${(vortex.sourceRank ?? 0) + 1} is outside the deterministic ${vortex.maximumFields}-field budget`,
              ]
            : status === "OFF"
              ? ["Vortex Field is disabled"]
              : [];
    effects.push({
      id: "vortexField",
      label: "Vortex Field",
      status,
      summary:
        status === "ACTIVE"
          ? "Vortex Field applies to this source"
          : (reasons[0] ?? status),
      measurements: {
        enabled,
        target: stringValue(values, "vfx.vortexField.target"),
        matchingSources: vortex.sourceCount,
        ...(vortex.sourceRank !== undefined
          ? { sourceRank: vortex.sourceRank + 1 }
          : {}),
        maximumFields: vortex.maximumFields,
      },
      reasons,
      controllingSettingIds: [
        "vfx.vortexField.enabled",
        "vfx.vortexField.target",
        "vfx.vortexField.maxFields",
        "vfx.vortexField.quality",
      ],
    });
  }

  {
    const enabled = booleanValue(values, "camera.dof.enabled");
    const mode = stringValue(values, "camera.dof.focusMode"),
      needsEntity =
        mode === "Selected Entity" || mode === "Selected Entity's cluster",
      hasFocus = !needsEntity || Boolean(selected),
      supported = measurements?.rendererSupported !== false,
      post = measurements?.postprocessingActive !== false,
      status: VisualDiagnosticStatus = !enabled
        ? "OFF"
        : !supported
          ? "UNSUPPORTED"
          : !post || !hasFocus
            ? "BLOCKED"
            : "ACTIVE",
      reasons: string[] = [];
    if (!enabled) reasons.push("Depth of Field is disabled");
    if (!supported)
      reasons.push("Renderer postprocessing capability is unavailable");
    if (!post) reasons.push("Postprocessing is not active");
    if (!hasFocus)
      reasons.push(
        `${mode} requires an entity selection; manual focus distance is the measurable fallback`,
      );
    effects.push({
      id: "depth-of-field",
      label: "Depth of Field",
      status,
      summary:
        status === "ACTIVE"
          ? `${mode} focus is active`
          : (reasons[0] ?? status),
      measurements: {
        enabled,
        focusMode: mode,
        focusDistance: numberValue(values, "camera.dof.focusDistance"),
        rendererSupported: supported,
        postprocessingActive: post,
      },
      reasons,
      controllingSettingIds: [
        "camera.dof.enabled",
        "camera.dof.focusMode",
        "camera.dof.focusDistance",
        "camera.dof.blurAmount",
        "camera.dof.maxBlur",
        "camera.dof.quality",
      ],
    });
  }
  if (booleanValue(values, "vfx.radialBlur.enabled")) {
    const event =
        selection.type === "event"
          ? options.events?.find(
              ({ eventId }) => eventId === selection.sourceIdentity,
            )
          : undefined,
      triggerId = event
        ? radialTriggerId(event)
        : selection.type === "entity"
          ? "vfx.radialBlur.trigger.selected"
          : undefined,
      relevant = Boolean(triggerId && booleanValue(values, triggerId));
    if (relevant) {
      const age = event ? frame.tick - event.tick : 0,
        duration = numberValue(values, "vfx.radialBlur.durationTicks"),
        budget = numberValue(values, "vfx.radialBlur.maxEvents"),
        status: VisualDiagnosticStatus =
          budget <= 0 ? "BLOCKED" : age > duration ? "INVISIBLE" : "ACTIVE",
        reasons =
          status === "BLOCKED"
            ? ["Maximum simultaneous radial events is zero"]
            : status === "INVISIBLE"
              ? [`Event age ${age} ticks exceeds the ${duration}-tick duration`]
              : [];
      effects.push({
        id: "radial-blur",
        label: "Radial Blur",
        status,
        summary:
          status === "ACTIVE"
            ? "This source contributes to the active screen-space radial pass"
            : (reasons[0] ?? status),
        measurements: {
          enabled: true,
          trigger: triggerId!,
          ageTicks: age,
          durationTicks: duration,
          maxEvents: budget,
        },
        reasons,
        controllingSettingIds: [
          "vfx.radialBlur.enabled",
          triggerId!,
          "vfx.radialBlur.durationTicks",
          "vfx.radialBlur.maxEvents",
          "vfx.radialBlur.strength",
          "vfx.radialBlur.radius",
        ],
      });
    }
  }
  const configuredFogEnabled = values["scene.fogEnabled"] === true;
  const fogType = stringValue(values, "scene.fogType");
  const fogStatus: VisualDiagnosticStatus = !configuredFogEnabled
    ? "OFF"
    : fogType === "none"
      ? "BLOCKED"
      : "ACTIVE";
  effects.push({
    id: "fog",
    label: "Fog influence",
    status: fogStatus,
    summary:
      fogStatus === "ACTIVE"
        ? `${fogType} fog is active`
        : fogStatus === "BLOCKED"
          ? "Fog type is none"
          : "Fog is disabled",
    measurements: {
      enabled: configuredFogEnabled,
      type: fogType,
    },
    reasons:
      fogStatus === "ACTIVE"
        ? []
        : [fogStatus === "BLOCKED" ? "Fog type is none" : "Fog is disabled"],
    controllingSettingIds: [
      "scene.fogEnabled",
      "scene.fogType",
      "scene.fogDensity",
      "scene.fogNear",
      "scene.fogFar",
      "scene.fogColor",
    ],
  });
  return effects;
}

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

export function formatVisualObjectState(
  state: EffectiveVisualObjectState,
): string {
  return [
    `${state.type.toUpperCase().replaceAll("-", " ")} ${state.sourceIdentity}`,
    "",
    ...state.attributes.flatMap((attribute) => [
      `${attribute.label}:`,
      `  source: ${attribute.source}`,
      `  effective: ${String(attribute.effectiveValue)}`,
      ...(attribute.rawValue !== undefined
        ? [`  raw: ${String(attribute.rawValue)}`]
        : []),
    ]),
    "",
    ...state.effects.flatMap((effect) => [
      `${effect.label}:`,
      `  status: ${effect.status}`,
      ...Object.entries(effect.measurements).map(
        ([key, value]) => `  ${key}: ${String(value)}`,
      ),
      ...effect.reasons.map((reason) => `  reason: ${reason}`),
    ]),
  ].join("\n");
}
