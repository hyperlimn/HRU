import * as THREE from "three";
import type {
  ObservationFrame,
  ObservedBond,
  ObservedEntity,
} from "../../observation-types";
import type { VisualEvent } from "../../observer-state";
import type { VisualConfiguration } from "../../../visual-lab/types";
import {
  booleanValue,
  numberValue,
  stringValue,
  vectorValue,
} from "../../../visual-lab/configuration";
import { transformedEntityVisual } from "../../../visual-lab/transform";
import { composeVfxValue, type VfxContribution } from "../mappings/composition";
import type { VfxCurve } from "../mappings/mapping";
import type { VfxDriverContext, VfxDriverId } from "../drivers/driver-registry";
import { particleFractions, particleSeed } from "./particle-identity";
import { concat, hexBytes, sha256Hex } from "../shared/sha256";
import type { HashHex } from "../../../shared/ids";
import { paletteColor, type Palette } from "../../../visual-lab/palettes";

export type ParticleTarget =
  | "Entities"
  | "Selected Entity"
  | "Positive Bonds"
  | "Weak Bonds"
  | "Repulsion"
  | "Relationships"
  | "Clusters"
  | "Contexts"
  | "Condensed Entities"
  | "Events";
export interface ParticleSource {
  readonly identity: string;
  readonly kind: ParticleTarget;
  center: readonly [number, number, number];
  readonly line?: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
  ];
  readonly extent: number;
  readonly color: string;
  readonly context: VfxDriverContext;
  readonly entity?: ObservedEntity;
}
export interface ParticleExplanation {
  readonly sourceIdentity: string;
  readonly seedHex: string;
  readonly fractions: ReturnType<typeof particleFractions>;
  readonly requested: number;
  readonly rendered: number;
  readonly effectiveRadius: number;
  readonly effectiveBrightness: number;
  readonly effectiveSizeRange: readonly [number, number];
  readonly activeDrivers: readonly string[];
}
export interface ParticleBuild {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly sizes: Float32Array;
  readonly sourceIdentities: readonly string[];
  readonly requested: number;
  readonly rendered: number;
  readonly fields: number;
  readonly explanations: ReadonlyMap<string, ParticleExplanation>;
}
export interface ParticleSourceDiagnostic {
  readonly sourceCount: number;
  readonly sourceRank?: number;
  readonly requested: number;
  readonly rendered: number;
  readonly globalRequested: number;
  readonly budget: number;
}
const zeroBuild = (): ParticleBuild => ({
  positions: new Float32Array(),
  colors: new Float32Array(),
  sizes: new Float32Array(),
  sourceIdentities: [],
  requested: 0,
  rendered: 0,
  fields: 0,
  explanations: new Map(),
});
const point = (value: {
  x: number;
  y: number;
  z: number;
}): readonly [number, number, number] => [value.x, value.y, value.z];
const midpoint = (
  a: readonly number[],
  b: readonly number[],
): readonly [number, number, number] => [
  (a[0]! + b[0]!) / 2,
  (a[1]! + b[1]!) / 2,
  (a[2]! + b[2]!) / 2,
];
const pairIdentity = (bond: Pick<ObservedBond, "low" | "high" | "pairHash">) =>
  bond.pairHash ?? sha256Hex(concat(hexBytes(bond.low), hexBytes(bond.high)));
const polarityColor = (bond: ObservedBond, values: VisualConfiguration) =>
  stringValue(
    values,
    bond.strength >= 0
      ? "relationship.positiveColor"
      : "relationship.negativeColor",
  );

function route(
  property: string,
  values: VisualConfiguration,
  context: VfxDriverContext,
): number {
  if (Object.keys(context).length === 0) return 1;
  const contribution = (slot: 1 | 2): VfxContribution => ({
    driver: stringValue(
      values,
      `vfx.particleField.route.${property}.driver${slot}`,
    ) as VfxDriverId,
    weight: numberValue(
      values,
      `vfx.particleField.route.${property}.weight${slot}`,
    ),
    mapping: {
      inputMin: numberValue(values, "vfx.particleField.mapping.inputMin"),
      inputMax: numberValue(values, "vfx.particleField.mapping.inputMax"),
      outputMin: numberValue(values, "vfx.particleField.mapping.outputMin"),
      outputMax: numberValue(values, "vfx.particleField.mapping.outputMax"),
      curve: stringValue(values, "vfx.particleField.mapping.curve") as VfxCurve,
      invert: booleanValue(values, "vfx.particleField.mapping.invert"),
      quantizeSteps: numberValue(values, "vfx.particleField.mapping.quantize"),
    },
  });
  return composeVfxValue([contribution(1), contribution(2)], {
    manual: 0.5,
    dimension: "dimension-0",
    ...context,
  });
}
export function particleSources(
  frame: ObservationFrame,
  events: readonly VisualEvent[],
  selected: HashHex | undefined,
  values: VisualConfiguration,
  palettes: readonly Palette[] = [],
): readonly ParticleSource[] {
  const target = stringValue(
      values,
      "vfx.particleField.target",
    ) as ParticleTarget,
    entities = new Map(frame.entities.map((entity) => [entity.hash, entity])),
    positions = new Map(
      frame.entities.map((entity) => [
        entity.hash,
        point(transformedEntityVisual(entity, values, palettes).position),
      ]),
    ),
    sources: ParticleSource[] = [];
  const entitySource = (
    entity: ObservedEntity,
    kind: ParticleTarget,
  ): ParticleSource => ({
    identity: entity.hash,
    kind,
    center: positions.get(entity.hash)!,
    extent: 0.4,
    color: transformedEntityVisual(entity, values, palettes).finalColor,
    context: { entityHash: entity.hash, contextHash: entity.contextHash },
    entity,
  });
  if (target === "Entities")
    for (const entity of frame.entities)
      sources.push(entitySource(entity, target));
  if (target === "Selected Entity" && selected && entities.has(selected))
    sources.push(entitySource(entities.get(selected)!, target));
  if (
    ["Positive Bonds", "Weak Bonds", "Repulsion", "Relationships"].includes(
      target,
    )
  )
    for (const bond of frame.bonds) {
      const kind =
        bond.classification === "active-positive"
          ? "Positive Bonds"
          : bond.classification === "active-repulsion"
            ? "Repulsion"
            : "Weak Bonds";
      if (target !== "Relationships" && target !== kind) continue;
      const a = positions.get(bond.low),
        b = positions.get(bond.high);
      if (!a || !b) continue;
      sources.push({
        identity: pairIdentity(bond),
        kind: kind as ParticleTarget,
        center: midpoint(a, b),
        line: [a, b],
        extent: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 2,
        color: polarityColor(bond, values),
        context: { pairHash: pairIdentity(bond), bondStrength: bond.strength },
      });
    }
  if (target === "Clusters")
    for (const cluster of frame.clusters) {
      const members = cluster.memberHashes
        .map((hash) => positions.get(hash))
        .filter((value): value is readonly [number, number, number] =>
          Boolean(value),
        );
      if (!members.length) continue;
      const center: [number, number, number] = [0, 0, 0];
      for (const member of members) {
        center[0] += member[0];
        center[1] += member[1];
        center[2] += member[2];
      }
      center[0] /= members.length;
      center[1] /= members.length;
      center[2] /= members.length;
      const extent = Math.max(
        0.4,
        ...members.map((member) =>
          Math.hypot(
            member[0] - center[0],
            member[1] - center[1],
            member[2] - center[2],
          ),
        ),
      );
      sources.push({
        identity: cluster.clusterHash,
        kind: target,
        center,
        extent,
        color: stringValue(values, "cluster.color"),
        context: {
          entityHash: cluster.clusterHash,
          clusterSize: members.length,
        },
      });
    }
  if (target === "Contexts")
    for (const entity of frame.entities)
      if (entity.contextHash !== "0".repeat(64))
        sources.push({
          ...entitySource(entity, target),
          identity: entity.contextHash,
          context: { entityHash: entity.hash, contextHash: entity.contextHash },
        });
  if (target === "Condensed Entities")
    for (const record of frame.condensationRecords) {
      const entity = entities.get(record.entityHash);
      if (entity)
        sources.push({
          ...entitySource(entity, target),
          color: stringValue(values, "condensation.color"),
        });
    }
  if (target === "Events") {
    const persistence = numberValue(
      values,
      "vfx.particleField.eventPersistenceTicks",
    );
    for (const visual of events) {
      const event = visual.event,
        age = frame.tick - event.tick;
      if (age < 0 || age > persistence) continue;
      const located = event.participants
        .map((hash) => positions.get(hash))
        .filter((value): value is readonly [number, number, number] =>
          Boolean(value),
        );
      if (!located.length) continue;
      const center =
        located.length >= 2 ? midpoint(located[0]!, located[1]!) : located[0]!;
      sources.push({
        identity: event.eventId,
        kind: target,
        center,
        ...(located.length >= 2
          ? { line: [located[0]!, located[1]!] as const }
          : {}),
        extent:
          located.length >= 2
            ? Math.hypot(
                located[0]![0] - located[1]![0],
                located[0]![1] - located[1]![1],
                located[0]![2] - located[1]![2],
              ) / 2
            : 0.5,
        color:
          event.type.includes("negative") || event.type.includes("repulsion")
            ? stringValue(values, "relationship.negativeColor")
            : stringValue(values, "relationship.positiveColor"),
        context: {
          eventAge: age,
          eventType: event.type,
          bondStrength: event.strength,
        },
      });
    }
  }
  return sources.sort((a, b) =>
    a.identity < b.identity
      ? -1
      : a.identity > b.identity
        ? 1
        : a.kind < b.kind
          ? -1
          : a.kind > b.kind
            ? 1
            : 0,
  );
}

export function diagnoseParticleSource(
  frame: ObservationFrame,
  events: readonly VisualEvent[],
  selected: HashHex | undefined,
  values: VisualConfiguration,
  identity: string,
  palettes: readonly Palette[] = [],
): ParticleSourceDiagnostic {
  const sources = particleSources(frame, events, selected, values, palettes),
    sourceRank = sources.findIndex((source) => source.identity === identity),
    quality = ({ Low: 0.5, Medium: 0.75, High: 1 } as const)[
      stringValue(values, "vfx.particleField.quality") as
        | "Low"
        | "Medium"
        | "High"
    ],
    perTarget = Math.floor(
      numberValue(values, "vfx.particleField.perTarget") * quality,
    ),
    budget = Math.floor(
      numberValue(values, "vfx.particleField.globalBudget") * quality,
    ),
    requests = sources.map((source) =>
      Math.max(
        0,
        Math.floor(
          perTarget * Math.max(0, route("density", values, source.context)),
        ),
      ),
    ),
    globalRequested = requests.reduce((sum, value) => sum + value, 0);
  if (sourceRank < 0)
    return {
      sourceCount: sources.length,
      requested: 0,
      rendered: 0,
      globalRequested,
      budget,
    };
  let low = 0,
    high = Math.max(0, ...requests);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2),
      allocated = requests.reduce(
        (sum, count) => sum + Math.min(count, middle),
        0,
      );
    if (allocated <= budget) low = middle;
    else high = middle - 1;
  }
  const fullRounds = low,
    allocated = requests.reduce(
      (sum, count) => sum + Math.min(count, fullRounds),
      0,
    ),
    remaining = Math.max(0, budget - allocated),
    eligibleBefore = requests
      .slice(0, sourceRank)
      .filter((count) => count > fullRounds).length,
    extra =
      requests[sourceRank]! > fullRounds && eligibleBefore < remaining ? 1 : 0;
  return {
    sourceCount: sources.length,
    sourceRank,
    requested: requests[sourceRank]!,
    rendered: Math.min(requests[sourceRank]!, fullRounds) + extra,
    globalRequested,
    budget,
  };
}

export function buildParticleField(
  frame: ObservationFrame,
  events: readonly VisualEvent[],
  selected: HashHex | undefined,
  values: VisualConfiguration,
  palettes: readonly Palette[] = [],
): ParticleBuild {
  if (!booleanValue(values, "vfx.particleField.enabled")) return zeroBuild();
  const sources = particleSources(frame, events, selected, values, palettes);
  if (!sources.length) return zeroBuild();
  const salt = numberValue(values, "vfx.particleField.visualSalt"),
    quality = ({ Low: 0.5, Medium: 0.75, High: 1 } as const)[
      stringValue(values, "vfx.particleField.quality") as
        | "Low"
        | "Medium"
        | "High"
    ],
    perTarget = Math.floor(
      numberValue(values, "vfx.particleField.perTarget") * quality,
    ),
    budget = Math.floor(
      numberValue(values, "vfx.particleField.globalBudget") * quality,
    ),
    requests = sources.map((source) =>
      Math.max(
        0,
        Math.floor(
          perTarget * Math.max(0, route("density", values, source.context)),
        ),
      ),
    ),
    requested = requests.reduce((sum, value) => sum + value, 0),
    slots: { source: number; index: number; identity: string }[] = [];
  for (
    let index = 0;
    slots.length < budget && requests.some((count) => index < count);
    index++
  )
    for (
      let source = 0;
      source < sources.length && slots.length < budget;
      source++
    )
      if (index < requests[source]!)
        slots.push({
          source,
          index,
          identity: sha256Hex(
            particleSeed(sources[source]!.identity, index, salt),
          ),
        });
  slots.sort((a, b) =>
    a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0,
  );
  const positions = new Float32Array(slots.length * 3),
    colors = new Float32Array(slots.length * 3),
    sizes = new Float32Array(slots.length),
    renderedBySource = new Map<number, number>();
  const offset = vectorValue(values, "vfx.particleField.offset"),
    stretch = vectorValue(values, "vfx.particleField.axialStretch"),
    spatial = numberValue(values, "vfx.particleField.spatialScale"),
    branches = numberValue(values, "vfx.particleField.branches"),
    placement = stringValue(values, "vfx.particleField.relationshipPlacement"),
    clusterMode = stringValue(values, "vfx.particleField.clusterMode");
  slots.forEach((slot, outIndex) => {
    const source = sources[slot.source]!,
      f = particleFractions(source.identity, slot.index, salt),
      tick = frame.tick,
      spread = route("spread", values, source.context),
      radius =
        numberValue(values, "vfx.particleField.radius") *
        route("radius", values, source.context) *
        (source.kind === "Clusters" ? source.extent : 1),
      inner = Math.min(
        radius,
        numberValue(values, "vfx.particleField.innerRadius"),
      ),
      shell = Math.max(
        0,
        Math.min(
          1,
          f.radial +
            numberValue(values, "vfx.particleField.shellBias") *
              (f.radial * f.radial - f.radial) -
            numberValue(values, "vfx.particleField.centerBias") *
              (f.radial - f.radial * f.radial),
        ),
      ),
      branch = Math.floor(f.angular * branches),
      tight = numberValue(values, "vfx.particleField.branchTightness"),
      disorder = numberValue(values, "vfx.particleField.disorder"),
      angle =
        Math.PI *
          2 *
          (branch / branches +
            (f.angular - 0.5) * (1 - tight * 0.1) +
            f.vertical * numberValue(values, "vfx.particleField.spiral")) +
        tick *
          (numberValue(values, "vfx.particleField.rotationSpeed") *
            route("rotationSpeed", values, source.context) +
            numberValue(values, "vfx.particleField.orbitalDrift") *
              (0.5 + f.motion)),
      radial =
        (inner + (radius - inner) * shell) *
          numberValue(values, "vfx.particleField.radialSpread") *
          spread +
        Math.sin(
          tick * numberValue(values, "vfx.particleField.radialDrift") +
            f.phase * Math.PI * 2,
        ) *
          radius *
          0.15,
      vertical =
        (f.vertical - 0.5) *
          numberValue(values, "vfx.particleField.verticalSpread") *
          spread +
        Math.sin(
          tick * numberValue(values, "vfx.particleField.verticalDrift") +
            f.motion * Math.PI * 2,
        ) *
          numberValue(values, "vfx.particleField.verticalSpread") *
          0.25,
      depth =
        (f.disorder - 0.5) *
        numberValue(values, "vfx.particleField.depthSpread") *
        disorder;
    let x = Math.cos(angle) * radial,
      y = vertical,
      z =
        Math.sin(
          angle + numberValue(values, "vfx.particleField.twist") * vertical,
        ) *
          radial +
        depth;
    const turbulence = numberValue(values, "vfx.particleField.turbulence");
    x += Math.sin(tick * 0.01 + f.motion * 17) * turbulence;
    y += Math.cos(tick * 0.013 + f.orientation * 19) * turbulence;
    z += Math.sin(tick * 0.017 + f.phase * 23) * turbulence;
    if (source.line && placement !== "Midpoint") {
      const [a, b] = source.line,
        t = f.radial,
        axis = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        length = Math.hypot(...axis),
        unit = length
          ? [axis[0] / length, axis[1] / length, axis[2] / length]
          : [0, 1, 0];
      const along = placement === "Along line" ? t : f.vertical,
        base = [
          a[0] + axis[0] * along,
          a[1] + axis[1] * along,
          a[2] + axis[2] * along,
        ],
        side = [-unit[2], 0, unit[0]],
        up = [
          -unit[0] * unit[1],
          unit[0] * unit[0] + unit[2] * unit[2],
          -unit[2] * unit[1],
        ];
      x =
        base[0] +
        (side[0] * Math.cos(angle) + up[0] * Math.sin(angle)) * radial;
      y =
        base[1] +
        (side[1] * Math.cos(angle) + up[1] * Math.sin(angle)) * radial;
      z =
        base[2] +
        (side[2] * Math.cos(angle) + up[2] * Math.sin(angle)) * radial;
    } else {
      x = source.center[0] + x * stretch[0] * spatial;
      y = source.center[1] + y * stretch[1] * spatial;
      z = source.center[2] + z * stretch[2] * spatial;
    }
    if (source.kind === "Clusters") {
      const factor =
        clusterMode === "Center field"
          ? 0.35
          : clusterMode === "Internal volume"
            ? 0.7
            : clusterMode === "Halo"
              ? 1.25
              : clusterMode === "Orbiting structure"
                ? 1.5
                : 1;
      x = source.center[0] + (x - source.center[0]) * factor;
      y = source.center[1] + (y - source.center[1]) * factor;
      z = source.center[2] + (z - source.center[2]) * factor;
    }
    positions.set([x + offset[0], y + offset[1], z + offset[2]], outIndex * 3);
    const eventDecay =
        source.kind === "Events"
          ? Math.max(
              0,
              1 -
                (source.context.eventAge ?? 0) /
                  Math.max(
                    1,
                    numberValue(
                      values,
                      "vfx.particleField.eventPersistenceTicks",
                    ),
                  ),
            )
          : 1,
      color = particleColor(source, f.color, values, palettes),
      brightness =
        numberValue(values, "vfx.particleField.brightness") *
        route("brightness", values, source.context) *
        route("opacity", values, source.context) *
        (0.65 + 0.35 * f.brightness) *
        eventDecay;
    color.multiplyScalar(brightness);
    colors.set([color.r, color.g, color.b], outIndex * 3);
    const min = numberValue(values, "vfx.particleField.minSize"),
      max = numberValue(values, "vfx.particleField.maxSize"),
      pulse =
        1 +
        Math.sin(
          tick *
            numberValue(values, "vfx.particleField.pulseFrequency") *
            Math.PI *
            2 +
            f.phase * Math.PI * 2,
        ) *
          numberValue(values, "vfx.particleField.pulseAmplitude") *
          route("pulseAmplitude", values, source.context);
    sizes[outIndex] =
      (min + (max - min) * f.size) *
      route("size", values, source.context) *
      pulse *
      eventDecay;
    renderedBySource.set(
      slot.source,
      (renderedBySource.get(slot.source) ?? 0) + 1,
    );
  });
  const explanations = new Map<string, ParticleExplanation>();
  sources.forEach((source, index) => {
    const f = particleFractions(source.identity, 0, salt);
    explanations.set(source.identity, {
      sourceIdentity: source.identity,
      seedHex: sha256Hex(particleSeed(source.identity, 0, salt)),
      fractions: f,
      requested: requests[index]!,
      rendered: renderedBySource.get(index) ?? 0,
      effectiveRadius:
        numberValue(values, "vfx.particleField.radius") *
        route("radius", values, source.context),
      effectiveBrightness:
        numberValue(values, "vfx.particleField.brightness") *
        route("brightness", values, source.context),
      effectiveSizeRange: [
        numberValue(values, "vfx.particleField.minSize") *
          route("size", values, source.context),
        numberValue(values, "vfx.particleField.maxSize") *
          route("size", values, source.context),
      ],
      activeDrivers: [
        "density",
        "radius",
        "size",
        "brightness",
        "opacity",
        "colorVariation",
        "rotationSpeed",
        "spread",
        "pulseAmplitude",
      ].flatMap((property) => [
        stringValue(values, `vfx.particleField.route.${property}.driver1`),
        ...(numberValue(values, `vfx.particleField.route.${property}.weight2`) >
        0
          ? [stringValue(values, `vfx.particleField.route.${property}.driver2`)]
          : []),
      ]),
    });
  });
  return {
    positions,
    colors,
    sizes,
    sourceIdentities: slots.map(({ source }) => sources[source]!.identity),
    requested,
    rendered: slots.length,
    fields: sources.length,
    explanations,
  };
}

function particleColor(
  source: ParticleSource,
  variation: number,
  values: VisualConfiguration,
  palettes: readonly Palette[],
): THREE.Color {
  const mode = stringValue(values, "vfx.particleField.colorMode"),
    identity =
      mode === "Pair hash"
        ? source.context.pairHash
        : mode === "Cluster / Context hash"
          ? (source.context.contextHash ?? source.identity)
          : source.identity;
  let color =
    mode === "Manual"
      ? new THREE.Color(stringValue(values, "vfx.particleField.manualColor"))
      : mode === "Entity rendered color"
        ? new THREE.Color(source.color)
        : mode === "Relationship polarity"
          ? new THREE.Color(source.color)
          : new THREE.Color().setHSL(
              Number.parseInt((identity ?? source.identity).slice(0, 8), 16) /
                0xffffffff,
              numberValue(values, "vfx.particleField.saturation"),
              numberValue(values, "vfx.particleField.lightness"),
            );
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(
    (hsl.h +
      (variation - 0.5) *
        numberValue(values, "vfx.particleField.colorVariation") *
        route("colorVariation", values, source.context) +
      1) %
      1,
    numberValue(values, "vfx.particleField.saturation"),
    numberValue(values, "vfx.particleField.lightness"),
  );
  return new THREE.Color(
    paletteColor(
      values,
      "Particle",
      Number.parseInt((identity ?? source.identity).slice(0, 8), 16) /
        0xffffffff,
      `#${color.getHexString()}`,
      palettes,
    ),
  );
}

export interface ParticleTelemetry {
  readonly activeFields: number;
  readonly requested: number;
  readonly rendered: number;
  readonly drawCalls: number;
  readonly buffers: number;
  readonly updateTicks: number;
  readonly cpuMilliseconds: number;
}
function sourceSignature(
  frame: ObservationFrame,
  events: readonly VisualEvent[],
): string {
  return `${frame.entities.map((entity) => `${entity.hash}:${entity.contextHash}:${entity.clusterHash ?? ""}`).join("|")}#${frame.bonds.map((bond) => `${bond.low}:${bond.high}:${bond.strength}`).join("|")}#${frame.clusters.map((cluster) => `${cluster.clusterHash}:${cluster.memberHashes.join(",")}`).join("|")}#${frame.condensationRecords.map((record) => record.entityHash).join("|")}#${events.map((event) => event.event.eventId).join("|")}`;
}
export class ParticleFieldRenderer {
  private points?: THREE.Points;
  private values?: VisualConfiguration;
  private frame?: ObservationFrame;
  private events: readonly VisualEvent[] = [];
  private selected?: HashHex;
  private lastBucket = -1;
  private lastSignature = "";
  private data: ParticleBuild = zeroBuild();
  private cpu = 0;
  private palettes: readonly Palette[] = [];
  constructor(private readonly parent: THREE.Object3D) {}
  configure(values: VisualConfiguration) {
    const changed = this.values !== values;
    this.values = values;
    if (changed) this.rebuild(true);
  }
  setPaletteLibrary(palettes: readonly Palette[]) {
    this.palettes = palettes;
    this.rebuild(false);
  }
  update(
    frame: ObservationFrame,
    events: readonly VisualEvent[],
    selected?: HashHex,
  ) {
    this.frame = frame;
    this.events = events;
    this.selected = selected;
    const every = this.values
        ? numberValue(this.values, "vfx.particleField.updateTicks")
        : 1,
      bucket = Math.floor(frame.tick / every),
      signature = sourceSignature(frame, events);
    if (bucket !== this.lastBucket || signature !== this.lastSignature) {
      this.rebuild(signature !== this.lastSignature);
      this.lastSignature = signature;
    }
  }
  setSelection(selected?: HashHex) {
    this.selected = selected;
    this.rebuild(true);
  }
  explanation(identity: string) {
    return this.data.explanations.get(identity);
  }
  sourceIdentityAt(index: number) {
    return this.data.sourceIdentities[index];
  }
  telemetry(): ParticleTelemetry {
    return {
      activeFields: this.data.fields,
      requested: this.data.requested,
      rendered: this.data.rendered,
      drawCalls: this.points ? 1 : 0,
      buffers: this.points ? 1 : 0,
      updateTicks: this.values
        ? numberValue(this.values, "vfx.particleField.updateTicks")
        : 0,
      cpuMilliseconds: this.cpu,
    };
  }
  dispose() {
    if (this.points) {
      this.parent.remove(this.points);
      this.points.geometry.dispose();
      (this.points.material as THREE.Material).dispose();
      this.points = undefined;
    }
    this.data = zeroBuild();
  }
  private rebuild(forceGeometry: boolean) {
    if (
      !this.values ||
      !this.frame ||
      !booleanValue(this.values, "vfx.particleField.enabled")
    ) {
      this.dispose();
      return;
    }
    const started = performance.now();
    const next = buildParticleField(
        this.frame,
        this.events,
        this.selected,
        this.values,
        this.palettes,
      ),
      sameCount =
        this.points && this.data.rendered === next.rendered && !forceGeometry;
    if (sameCount) {
      const geometry = this.points!.geometry;
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(next.positions, 3),
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(next.colors, 3));
      geometry.setAttribute(
        "particleSize",
        new THREE.BufferAttribute(next.sizes, 1),
      );
    } else {
      this.dispose();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(next.positions, 3),
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(next.colors, 3));
      geometry.setAttribute(
        "particleSize",
        new THREE.BufferAttribute(next.sizes, 1),
      );
      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthTest: booleanValue(this.values, "vfx.particleField.depthTest"),
        depthWrite: booleanValue(this.values, "vfx.particleField.depthWrite"),
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        uniforms: {
          opacity: {
            value:
              numberValue(this.values, "vfx.particleField.opacity") *
              route("opacity", this.values, {}),
          },
          glow: { value: numberValue(this.values, "vfx.particleField.glow") },
        },
        vertexShader:
          "attribute float particleSize; varying vec3 vColor; void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=max(1.0,particleSize*300.0/max(0.1,-mv.z));gl_Position=projectionMatrix*mv;}",
        fragmentShader:
          "uniform float opacity; uniform float glow; varying vec3 vColor; void main(){vec2 p=gl_PointCoord-0.5;float d=dot(p,p);if(d>0.25)discard;float soft=smoothstep(0.25,0.02,d);gl_FragColor=vec4(vColor*(1.0+glow),opacity*soft);}",
      });
      this.points = new THREE.Points(geometry, material);
      this.points.name = "vfx:particle-field";
      this.parent.add(this.points);
    }
    this.data = next;
    this.lastBucket = Math.floor(
      this.frame.tick /
        numberValue(this.values, "vfx.particleField.updateTicks"),
    );
    this.cpu = performance.now() - started;
  }
}
