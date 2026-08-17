import * as THREE from "three";
import type { ObservationFrame, RelationshipEvent } from "../observation-types";
import type { HashHex } from "../../shared/ids";
import { ZERO_CONTEXT_HEX } from "../../core/state";
import { dimensionZeroPosition } from "../dimension-0";
import { renderTraits } from "../render-traits";
import type { RenderChannelId } from "../render-channels";
import type { VisualEvent } from "../observer-state";
import type { VisualConfiguration } from "../../visual-lab/types";
import { visualRegistry } from "../../visual-lab/registry";
import {
  booleanValue,
  numberValue,
  stringValue,
  vectorValue,
} from "../../visual-lab/configuration";
import {
  entityGeometryDetail,
  transformedEntityVisual,
} from "../../visual-lab/transform";
import {
  selectiveBloomIntensity,
  vfxTargetMatches,
} from "../vfx/postprocessing/selective-bloom";
import { ParticleFieldRenderer } from "../vfx/procedural/particle-field";
import { VortexFieldRenderer } from "../vfx/procedural/vortex-field";
import { paletteChannelColor, type Palette } from "../../visual-lab/palettes";
import type { VisualSelection } from "../visual-object";
import { selectionForBond, selectionForEntity } from "../visual-object";

export type ChannelVisibility = Readonly<Record<RenderChannelId, boolean>>;

export class InstanceSelectionMap {
  private readonly values = new Map<string, VisualSelection>();
  set(
    object: THREE.Object3D,
    instanceId: number,
    selection: VisualSelection,
  ): void {
    this.values.set(`${object.uuid}:${instanceId}`, selection);
  }
  get(object: THREE.Object3D, instanceId: number): VisualSelection | undefined {
    return this.values.get(`${object.uuid}:${instanceId}`);
  }
  clear(): void {
    this.values.clear();
  }
}

export function applyChannelVisibility(
  groups: Readonly<Record<RenderChannelId, THREE.Object3D>>,
  channels: ChannelVisibility,
): void {
  for (const id of Object.keys(groups) as RenderChannelId[])
    groups[id].visible = channels[id];
}

export class ThreeObservationRenderer {
  readonly selectionMap = new InstanceSelectionMap();
  private readonly groups: Record<RenderChannelId, THREE.Group>;
  private frame?: ObservationFrame;
  private visualEvents: readonly VisualEvent[] = [];
  private selected?: HashHex;
  private entityMeshes: THREE.InstancedMesh[] = [];
  private readonly seenEvents = new Set<string>();
  private visual: VisualConfiguration = visualRegistry.defaults();
  private geometryRevision = 0;
  private readonly entityGeometries = new Map<string, THREE.BufferGeometry>();
  private readonly particleField: ParticleFieldRenderer;
  private readonly vortexField: VortexFieldRenderer;
  private palettes: readonly Palette[] = [];
  private visualConfigured = false;
  private color(
    role: Parameters<typeof paletteChannelColor>[1],
    identity: string | undefined,
    explicit: string,
    channel = role.toLowerCase().replaceAll(" ", "-"),
  ): string {
    return paletteChannelColor(
      this.visual,
      role,
      identity ?? "observer-default",
      channel,
      explicit,
      this.palettes,
    );
  }

  constructor(private readonly scene: THREE.Scene) {
    this.groups = Object.fromEntries(
      (
        [
          "entities",
          "positive-bonds",
          "repulsion",
          "clusters",
          "contexts",
          "phase-effects",
          "ancestry",
          "condensed-entities",
          "dimension-effects",
        ] as RenderChannelId[]
      ).map((id) => [id, new THREE.Group()]),
    ) as Record<RenderChannelId, THREE.Group>;
    for (const [id, group] of Object.entries(this.groups)) {
      group.name = `observation:${id}`;
      scene.add(group);
    }
    this.particleField = new ParticleFieldRenderer(
      this.groups["phase-effects"],
    );
    this.vortexField = new VortexFieldRenderer(this.groups["phase-effects"]);
    this.rebuildGrid();
    this.groups["dimension-effects"].position.y = -12;
  }

  setVisualConfiguration(values: VisualConfiguration): {
    geometryRebuilt: boolean;
  } {
    const geometryRebuilt = [
      "entity.geometryDetail",
      "entity.minHashSmoothness",
      "entity.maxHashSmoothness",
      "entity.hashSmoothnessStrength",
    ].some((id) => this.visual[id] !== values[id]);
    const gridChanged = [
      "scene.gridSize",
      "scene.gridDivisions",
      "scene.gridPrimary",
      "scene.gridSecondary",
      "scene.gridOpacity",
    ].some((id) => this.visual[id] !== values[id]);
    const paletteChanged = Object.keys(values).some(
      (id) => id.startsWith("palette.") && this.visual[id] !== values[id],
    );
    const prior = this.visual;
    const changedIds = Object.keys(values).filter(
      (id) => prior[id] !== values[id],
    );
    this.visual = values;
    const sourceAppearanceChanged = (prefix: string) =>
      changedIds.some(
        (id) =>
          id.startsWith(prefix) ||
          /^(palette|entity|relationship|cluster|context|condensation)\./.test(
            id,
          ) ||
          id === "scene.worldSpread",
      );
    if (!this.visualConfigured || sourceAppearanceChanged("vfx.particleField."))
      this.particleField.configure(values);
    if (!this.visualConfigured || sourceAppearanceChanged("vfx.vortexField."))
      this.vortexField.configure(values);
    this.visualConfigured = true;
    if (geometryRebuilt) {
      this.geometryRevision += 1;
      this.entityGeometries.forEach((geometry) => geometry.dispose());
      this.entityGeometries.clear();
    }
    if (gridChanged || paletteChanged) this.rebuildGrid();
    const grid = this.groups["dimension-effects"].children[0];
    if (grid) grid.visible = booleanValue(values, "scene.gridEnabled");
    const rotation = vectorValue(values, "scene.worldRotation"),
      origin = vectorValue(values, "scene.originOffset");
    for (const [id, group] of Object.entries(this.groups)) {
      if (id === "dimension-effects") continue;
      group.rotation.set(...rotation);
      group.position.set(...origin);
    }
    const gridRotation = vectorValue(values, "scene.gridRotation");
    this.groups["dimension-effects"].rotation.set(...gridRotation);
    this.groups["dimension-effects"].position.y = numberValue(
      values,
      "scene.gridHeight",
    );
    const projectionChanged = Object.keys(values).some(
      (id) =>
        prior[id] !== values[id] &&
        /^(palette|entity|relationship|cluster|context|condensation|selection)\.|^scene\.worldSpread$/.test(
          id,
        ),
    );
    if (projectionChanged) this.rebuildCurrent();
    if (
      changedIds.some((id) =>
        /^(palette|relationship|cluster|condensation)\./.test(id),
      )
    )
      this.rebuildTransients();
    return { geometryRebuilt };
  }
  debugGeometryRevision(): number {
    return this.geometryRevision;
  }
  debugEntityGeometryCount(): number {
    return this.entityGeometries.size;
  }
  setPaletteLibrary(palettes: readonly Palette[]): void {
    this.palettes = palettes.filter(({ builtIn }) => !builtIn);
    this.particleField.setPaletteLibrary(this.palettes);
    this.vortexField.setPaletteLibrary(this.palettes);
    this.rebuildGrid();
    this.rebuildCurrent();
    this.rebuildTransients();
  }

  update(frame: ObservationFrame, events: readonly VisualEvent[]): void {
    this.visualEvents = events;
    if (this.frame?.stateDigest !== frame.stateDigest) {
      this.frame = frame;
      this.rebuildCurrent();
    }
    this.particleField.update(frame, events, this.selected);
    this.vortexField.update(frame, events, this.selected);
    for (const visual of events)
      if (
        !this.seenEvents.has(visual.event.eventId) &&
        this.addTransient(visual.event, visual.observedAt)
      )
        this.seenEvents.add(visual.event.eventId);
    if (this.seenEvents.size > 2048) this.seenEvents.clear();
  }
  setChannels(channels: ChannelVisibility): void {
    applyChannelVisibility(this.groups, channels);
  }
  setSelection(hash?: HashHex): void {
    const changed = this.selected !== hash;
    this.selected = hash;
    this.particleField.setSelection(hash);
    this.vortexField.setSelection(hash);
    if (changed) this.rebuildCurrent();
    else this.rebuildSelection();
  }
  particleTelemetry() {
    return this.particleField.telemetry();
  }
  particleExplanation(hash: string) {
    return this.particleField.explanation(hash);
  }
  vortexTelemetry() {
    return this.vortexField.telemetry();
  }
  vortexExplanation(hash: string) {
    return this.vortexField.explanation(hash);
  }
  raycastTargets(): readonly THREE.Object3D[] {
    return [
      "entities",
      "positive-bonds",
      "repulsion",
      "clusters",
      "contexts",
      "phase-effects",
      "condensed-entities",
    ].map((id) => this.groups[id as RenderChannelId]);
  }
  visualSelection(
    intersection: THREE.Intersection,
  ): VisualSelection | undefined {
    if (
      intersection.object.name === "vfx:particle-field" &&
      intersection.index !== undefined
    ) {
      const sourceIdentity = this.particleField.sourceIdentityAt(
        intersection.index,
      );
      return sourceIdentity
        ? {
            type: "particle-field-source",
            sourceIdentity,
            sourceType: "Particle Field source",
            transientObjectId: String(intersection.index),
            ...(this.frame?.entities.some(({ hash }) => hash === sourceIdentity)
              ? { entityHash: sourceIdentity }
              : {}),
          }
        : undefined;
    }
    if (
      intersection.object.name === "vfx:vortex-field" &&
      intersection.index !== undefined
    ) {
      const sourceIdentity = this.vortexField.sourceIdentityAt(
        intersection.index,
      );
      return sourceIdentity
        ? {
            type: "vortex-field-source",
            sourceIdentity,
            sourceType: "Vortex Field source",
            transientObjectId: String(intersection.index),
            ...(this.frame?.entities.some(({ hash }) => hash === sourceIdentity)
              ? { entityHash: sourceIdentity }
              : {}),
          }
        : undefined;
    }
    return intersection.instanceId === undefined
      ? (intersection.object.userData.visualSelection as
          | VisualSelection
          | undefined)
      : this.selectionMap.get(intersection.object, intersection.instanceId);
  }
  animate(now: number): readonly VisualSelection[] {
    const expiredSelections: VisualSelection[] = [];
    for (const object of [...this.groups["phase-effects"].children]) {
      if (object.userData.expires === undefined) continue;
      const start = object.userData.start as number;
      const expires = object.userData.expires as number;
      const progress = Math.max(
        0,
        Math.min(1, (now - start) / (expires - start)),
      );
      const material = (object as THREE.Mesh).material as THREE.Material & {
        opacity?: number;
      };
      if ("opacity" in material)
        material.opacity =
          Number(object.userData.baseOpacity ?? 1) * (1 - progress);
      const pulse =
        1 +
        Math.sin(
          now *
            0.001 *
            numberValue(this.visual, "relationship.pulseSpeed") *
            Math.PI *
            2,
        ) *
          0.12;
      object.scale.setScalar((1 + progress * 2) * pulse);
      if (now >= expires) {
        const selection = object.userData.visualSelection as
          | VisualSelection
          | undefined;
        if (selection) expiredSelections.push(selection);
        this.groups["phase-effects"].remove(object);
        disposeObject(object);
      }
    }
    if (booleanValue(this.visual, "entity.idlePulse")) {
      const pulse =
        1 +
        Math.sin(
          now * 0.001 * numberValue(this.visual, "entity.idlePulseSpeed"),
        ) *
          numberValue(this.visual, "entity.idlePulseAmount");
      for (const mesh of this.entityMeshes)
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
          Number(
            mesh.userData.baseEmissiveIntensity ??
              numberValue(this.visual, "entity.emissiveMultiplier"),
          ) * pulse;
    }
    const highlight = this.groups.entities.getObjectByName(
      "selection-highlight",
    );
    if (highlight && booleanValue(this.visual, "selection.pulse")) {
      const pulse =
        1 +
        Math.sin(
          now * 0.001 * numberValue(this.visual, "selection.pulseSpeed"),
        ) *
          0.08;
      highlight.scale.setScalar(pulse);
    }
    return expiredSelections;
  }
  dispose(): void {
    this.particleField.dispose();
    this.vortexField.dispose();
    for (const group of Object.values(this.groups)) {
      clearGroup(group);
      this.scene.remove(group);
    }
    this.entityGeometries.forEach((geometry) => geometry.dispose());
    this.entityGeometries.clear();
  }

  private rebuildCurrent(): void {
    for (const id of [
      "entities",
      "positive-bonds",
      "repulsion",
      "clusters",
      "contexts",
      "ancestry",
      "condensed-entities",
    ] as RenderChannelId[])
      clearGroup(this.groups[id], id !== "entities");
    this.selectionMap.clear();
    this.entityMeshes = [];
    if (!this.frame) return;
    const transformed = new Map(
      this.frame.entities.map(
        (entity) =>
          [
            entity.hash,
            transformedEntityVisual(entity, this.visual, this.palettes),
          ] as const,
      ),
    );
    const positions = new Map(
      this.frame.entities.map((entity) => {
        const position = transformed.get(entity.hash)!.position;
        return [
          entity.hash,
          new THREE.Vector3(position.x, position.y, position.z),
        ] as const;
      }),
    );
    for (let variation = 0; variation < 3; variation += 1) {
      for (let detail = 0; detail <= 5; detail += 1) {
        const candidates = this.frame.entities.filter((entity) => {
          const traits = renderTraits(
            entity.hash,
            entity.provenance,
            entity.contextHash,
            Boolean(entity.clusterHash),
          );
          return (
            traits.geometryVariation === variation &&
            entityGeometryDetail(entity, this.visual) === detail
          );
        });
        const materialGroups = new Map<
          string,
          {
            readonly entities: typeof candidates;
            readonly emissiveColor: string;
            readonly emissiveIntensity: number;
            readonly containsSelected: boolean;
            readonly vfxIntensity: number;
          }
        >();
        for (const entity of candidates) {
          const target = stringValue(this.visual, "vfx.selective.target");
          const vfxIntensity = vfxTargetMatches(target, "Entities")
            ? selectiveBloomIntensity(this.visual, {
                entityHash: entity.hash,
                contextHash: entity.contextHash,
                dimension: "dimension-0",
              })
            : 0;
          const traits = renderTraits(
            entity.hash,
            entity.provenance,
            entity.contextHash,
            Boolean(entity.clusterHash),
          );
          const legacyEmissive = new THREE.Color(0x061824).lerp(
            new THREE.Color().setHSL(traits.emissiveHue, 0.8, 0.5),
            numberValue(this.visual, "entity.emissiveInfluence"),
          );
          const emissiveColor = this.color(
            "Glow",
            entity.hash,
            `#${legacyEmissive.getHexString()}`,
            "entity/glow",
          );
          const emissiveIntensity =
            transformed.get(entity.hash)!.emissive + vfxIntensity;
          const containsSelected = entity.hash === this.selected;
          const materialKey = `${emissiveColor}:${emissiveIntensity}:${vfxIntensity}:${containsSelected}`;
          const group = materialGroups.get(materialKey);
          if (group) group.entities.push(entity);
          else
            materialGroups.set(materialKey, {
              entities: [entity],
              emissiveColor,
              emissiveIntensity,
              containsSelected,
              vfxIntensity,
            });
        }
        for (const {
          entities,
          emissiveColor,
          emissiveIntensity,
          containsSelected,
          vfxIntensity,
        } of materialGroups.values()) {
          if (!entities.length) continue;
          const key = `${variation}:${detail}`;
          let geometry = this.entityGeometries.get(key);
          if (!geometry) {
            geometry =
              variation === 0
                ? new THREE.IcosahedronGeometry(1, detail)
                : variation === 1
                  ? new THREE.OctahedronGeometry(1, detail)
                  : new THREE.DodecahedronGeometry(1, detail);
            this.entityGeometries.set(key, geometry);
          }
          const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: numberValue(this.visual, "entity.roughness"),
            metalness: numberValue(this.visual, "entity.metalness"),
            opacity: numberValue(this.visual, "entity.opacity"),
            transparent: numberValue(this.visual, "entity.opacity") < 1,
            emissive: new THREE.Color(emissiveColor),
            emissiveIntensity,
            wireframe: booleanValue(this.visual, "entity.wireframe"),
            depthTest: booleanValue(this.visual, "entity.depthTest"),
            depthWrite: booleanValue(this.visual, "entity.depthWrite"),
            toneMapped: vfxIntensity === 0,
          });
          const mesh = new THREE.InstancedMesh(
            geometry,
            material,
            entities.length,
          );
          mesh.userData.observationEntities = true;
          mesh.userData.geometryVariation = variation;
          mesh.userData.geometryDetail = detail;
          mesh.userData.containsSelected = containsSelected;
          mesh.userData.baseEmissiveIntensity = material.emissiveIntensity;
          entities.forEach((entity, index) => {
            const traits = renderTraits(
              entity.hash,
              entity.provenance,
              entity.contextHash,
              Boolean(entity.clusterHash),
            );
            const visual = transformed.get(entity.hash)!;
            const influence = numberValue(
                this.visual,
                "entity.orientationInfluence",
              ),
              axes = vectorValue(this.visual, "entity.scaleAxes");
            const matrix = new THREE.Matrix4().compose(
              positions.get(entity.hash)!,
              new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                  ...(traits.orientation.map((value) => value * influence) as [
                    number,
                    number,
                    number,
                  ]),
                ),
              ),
              new THREE.Vector3(
                visual.size * axes[0],
                visual.size * axes[1],
                visual.size * axes[2],
              ),
            );
            mesh.setMatrixAt(index, matrix);
            mesh.setColorAt(
              index,
              new THREE.Color(
                this.color(
                  "Entity",
                  entity.hash,
                  visual.finalColor,
                  "entity/base",
                ),
              ),
            );
            this.selectionMap.set(mesh, index, selectionForEntity(entity));
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          this.groups.entities.add(mesh);
          this.entityMeshes.push(mesh);
        }
      }
    }
    for (const bond of this.frame.bonds) {
      const positive = bond.strength >= 0;
      const active =
        bond.classification === "active-positive" ||
        bond.classification === "active-repulsion";
      const actualTarget = positive
        ? active
          ? "Positive Bonds"
          : "Weak Bonds"
        : active
          ? "Repulsion"
          : "Weak Bonds";
      const vfxIntensity = vfxTargetMatches(
        stringValue(this.visual, "vfx.selective.target"),
        actualTarget,
      )
        ? selectiveBloomIntensity(this.visual, {
            pairHash: bond.pairHash,
            bondStrength: bond.strength,
            dimension: "dimension-0",
          })
        : 0;
      const role = positive
        ? active
          ? "Positive Relationship"
          : "Weak Relationship"
        : "Repulsion";
      const bondColor = new THREE.Color(
        this.color(
          role,
          bond.pairHash,
          stringValue(
            this.visual,
            positive
              ? "relationship.positiveColor"
              : "relationship.negativeColor",
          ),
          "relationship/base",
        ),
      ).multiplyScalar(1 + vfxIntensity);
      const material = new THREE.MeshBasicMaterial({
        color: bondColor,
        transparent: true,
        opacity: active
          ? numberValue(
              this.visual,
              positive
                ? "relationship.activeOpacity"
                : "relationship.repulsionOpacity",
            )
          : numberValue(this.visual, "relationship.weakOpacity"),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: booleanValue(this.visual, "relationship.depthTest"),
        toneMapped: vfxIntensity === 0,
      });
      const minRadius = numberValue(this.visual, "relationship.minRadius"),
        maxRadius = numberValue(this.visual, "relationship.maxRadius");
      const radius =
        (minRadius + (maxRadius - minRadius) * Math.abs(bond.strength)) *
        (active
          ? numberValue(
              this.visual,
              positive
                ? "relationship.activeThickness"
                : "relationship.repulsionThickness",
            )
          : 1);
      const connection = cylinderBetween(
        positions.get(bond.low)!,
        positions.get(bond.high)!,
        radius,
        material,
        numberValue(this.visual, "relationship.radialSegments"),
      );
      connection.userData.participants = [bond.low, bond.high];
      connection.userData.baseOpacity = material.opacity;
      connection.userData.visualSelection = selectionForBond(bond);
      this.groups[positive ? "positive-bonds" : "repulsion"].add(connection);
    }
    for (const cluster of this.frame.clusters) {
      const points = cluster.memberHashes.map((hash) => positions.get(hash)!);
      const center = centroid(points);
      const radius =
        (Math.max(0.5, ...points.map((point) => point.distanceTo(center))) +
          0.35) *
        numberValue(this.visual, "cluster.scale");
      const segments = numberValue(this.visual, "cluster.segments");
      const vfxIntensity = vfxTargetMatches(
        stringValue(this.visual, "vfx.selective.target"),
        "Clusters",
      )
        ? selectiveBloomIntensity(this.visual, {
            clusterSize: cluster.memberHashes.length,
            entityHash: cluster.clusterHash,
            dimension: "dimension-0",
          })
        : 0;
      const clusterMesh = new THREE.Mesh(
        new THREE.SphereGeometry(
          radius,
          segments,
          Math.max(3, Math.floor(segments * 0.625)),
        ),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(
            this.color(
              "Cluster",
              cluster.clusterHash,
              stringValue(this.visual, "cluster.color"),
              "cluster/shell",
            ),
          ).multiplyScalar(1 + vfxIntensity),
          wireframe: booleanValue(this.visual, "cluster.wireframe"),
          transparent: true,
          opacity: numberValue(this.visual, "cluster.opacity"),
          toneMapped: vfxIntensity === 0,
        }),
      );
      clusterMesh.visible = booleanValue(this.visual, "cluster.enabled");
      clusterMesh.userData.visualSelection = {
        type: "cluster",
        sourceIdentity: cluster.clusterHash,
        sourceType: "Cluster",
      } satisfies VisualSelection;
      this.groups.clusters.add(clusterMesh);
      this.groups.clusters.children.at(-1)!.position.copy(center);
    }
    for (const entity of this.frame.entities)
      if (entity.contextHash !== ZERO_CONTEXT_HEX) {
        const legacy = new THREE.Color().setHSL(
          renderTraits(entity.hash, entity.provenance, entity.contextHash, true)
            .accentHue,
          numberValue(this.visual, "context.colorInfluence"),
          0.6,
        );
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(
            0.34 * numberValue(this.visual, "context.scale"),
            numberValue(this.visual, "context.thickness"),
            6,
            numberValue(this.visual, "context.segments"),
          ),
          new THREE.MeshBasicMaterial({
            color: this.color(
              "Context",
              entity.contextHash,
              `#${legacy.getHexString()}`,
              "context/ring",
            ),
            transparent: true,
            opacity: numberValue(this.visual, "context.opacity"),
          }),
        );
        ring.position.copy(positions.get(entity.hash)!);
        ring.visible = booleanValue(this.visual, "context.enabled");
        ring.userData.visualSelection = {
          type: "context",
          sourceIdentity: entity.contextHash,
          sourceType: "Context",
          entityHash: entity.hash,
          transientObjectId: `context:${entity.hash}`,
        } satisfies VisualSelection;
        this.groups.contexts.add(ring);
      }
    for (const record of this.frame.condensationRecords) {
      const child = positions.get(record.entityHash);
      if (!child) continue;
      const accent = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 12, 8),
        new THREE.MeshBasicMaterial({
          color: this.color(
            "Condensed Entity",
            record.entityHash,
            stringValue(this.visual, "condensation.color"),
            "condensed/accent",
          ),
          wireframe: true,
          transparent: true,
          opacity: 0.45,
        }),
      );
      accent.position.copy(child);
      accent.userData.visualSelection = {
        type: "condensed-entity",
        sourceIdentity: record.entityHash,
        sourceType: "Condensed Entity",
        entityHash: record.entityHash,
      } satisfies VisualSelection;
      this.groups["condensed-entities"].add(accent);
      for (const parent of record.parentHashes)
        if (positions.has(parent))
          this.groups.ancestry.add(
            cylinderBetween(
              child,
              positions.get(parent)!,
              0.008,
              new THREE.MeshBasicMaterial({
                color: this.color("Accent", parent, "#ffd37a", "ancestry/line"),
                transparent: true,
                opacity: 0.18,
              }),
            ),
          );
    }
    this.rebuildSelection();
  }
  private rebuildSelection(): void {
    const existing = this.groups.entities.getObjectByName(
      "selection-highlight",
    );
    if (existing) {
      this.groups.entities.remove(existing);
      disposeObject(existing);
    }
    const baseEntityOpacity = numberValue(this.visual, "entity.opacity");
    for (const mesh of this.entityMeshes) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.opacity =
        this.selected && !mesh.userData.containsSelected
          ? baseEntityOpacity *
            (1 - numberValue(this.visual, "selection.dimUnselected"))
          : baseEntityOpacity;
      material.transparent = material.opacity < 1;
    }
    for (const group of [this.groups["positive-bonds"], this.groups.repulsion])
      group.traverse((object) => {
        const material = (object as THREE.Mesh).material as
          | THREE.MeshBasicMaterial
          | undefined;
        if (!material) return;
        const base = Number(object.userData.baseOpacity ?? material.opacity);
        const participants = object.userData.participants as
          | readonly HashHex[]
          | undefined;
        material.opacity =
          this.selected && participants?.includes(this.selected)
            ? Math.min(
                1,
                base * numberValue(this.visual, "selection.bondEmphasis"),
              )
            : base;
      });
    if (
      !this.selected ||
      !this.frame?.entities.some((entity) => entity.hash === this.selected)
    )
      return;
    const selectedEntity = this.frame.entities.find(
      (entity) => entity.hash === this.selected,
    )!;
    const vfxIntensity = vfxTargetMatches(
      stringValue(this.visual, "vfx.selective.target"),
      "Selected Entity",
    )
      ? selectiveBloomIntensity(this.visual, {
          entityHash: selectedEntity.hash,
          contextHash: selectedEntity.contextHash,
          dimension: "dimension-0",
        })
      : 0;
    const highlight = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.55 * numberValue(this.visual, "selection.scale"),
        16,
        10,
      ),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(
          this.color(
            "Selection",
            selectedEntity.hash,
            stringValue(this.visual, "selection.color"),
            "entity/selection",
          ),
        ).multiplyScalar(1 + vfxIntensity),
        wireframe: true,
        transparent: true,
        opacity: numberValue(this.visual, "selection.opacity"),
        toneMapped: vfxIntensity === 0,
      }),
    );
    const raw = dimensionZeroPosition(this.selected);
    const spread = numberValue(this.visual, "scene.worldSpread");
    highlight.position.set(raw.x * spread, raw.y * spread, raw.z * spread);
    highlight.name = "selection-highlight";
    this.groups.entities.add(highlight);
  }
  private addTransient(event: RelationshipEvent, observedAt: number): boolean {
    if (!this.frame) return false;
    const spread = numberValue(this.visual, "scene.worldSpread");
    const positions = new Map(
      this.frame.entities.map((entity) => {
        const p = dimensionZeroPosition(entity.hash);
        return [
          entity.hash,
          new THREE.Vector3(p.x * spread, p.y * spread, p.z * spread),
        ] as const;
      }),
    );
    let object: THREE.Mesh | undefined;
    if (
      (event.type === "cluster-formed" || event.type === "cluster-dissolved") &&
      event.participants.every((hash) => positions.has(hash))
    ) {
      const center = centroid(
        event.participants.map((hash) => positions.get(hash)!),
      );
      object = new THREE.Mesh(
        new THREE.SphereGeometry(
          (0.7 * numberValue(this.visual, "relationship.eventScale")) / 2,
          14,
          9,
        ),
        new THREE.MeshBasicMaterial({
          color: this.color(
            "Event",
            event.eventId,
            stringValue(this.visual, "cluster.color"),
            "event/cluster",
          ),
          wireframe: true,
          transparent: true,
          opacity: Math.min(
            1,
            numberValue(this.visual, "relationship.eventBrightness"),
          ),
        }),
      );
      object.position.copy(center);
    } else if (
      event.type === "entity-condensed" &&
      positions.has(event.participants[0]!)
    ) {
      object = new THREE.Mesh(
        new THREE.SphereGeometry(
          (0.65 * numberValue(this.visual, "relationship.eventScale")) / 2,
          14,
          9,
        ),
        new THREE.MeshBasicMaterial({
          color: this.color(
            "Condensed Entity",
            event.eventId,
            stringValue(this.visual, "condensation.color"),
            "event/accent",
          ),
          wireframe: true,
          transparent: true,
          opacity: Math.min(
            1,
            numberValue(this.visual, "relationship.eventBrightness"),
          ),
        }),
      );
      object.position.copy(positions.get(event.participants[0]!)!);
    } else if (
      event.participants.length >= 2 &&
      positions.has(event.participants[0]!) &&
      positions.has(event.participants[1]!)
    ) {
      const negative =
        event.type.includes("negative") || event.type.includes("repulsion");
      const dissolved = event.type === "bond-dissolved";
      object = cylinderBetween(
        positions.get(event.participants[0]!)!,
        positions.get(event.participants[1]!)!,
        ((dissolved ? 0.02 : 0.045) *
          numberValue(this.visual, "relationship.eventScale")) /
          2,
        new THREE.MeshBasicMaterial({
          color: this.color(
            "Event",
            event.eventId,
            stringValue(
              this.visual,
              negative
                ? "relationship.negativeColor"
                : "relationship.positiveColor",
            ),
            "relationship/pulse",
          ),
          transparent: true,
          opacity: dissolved
            ? numberValue(this.visual, "relationship.ghostOpacity")
            : Math.min(
                1,
                numberValue(this.visual, "relationship.eventBrightness"),
              ),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
    } else if (positions.has(event.participants[0]!)) {
      object = new THREE.Mesh(
        new THREE.SphereGeometry(
          (0.45 * numberValue(this.visual, "relationship.eventScale")) / 2,
          14,
          9,
        ),
        new THREE.MeshBasicMaterial({
          color: this.color("Event", event.eventId, "#8effc1", "event/accent"),
          wireframe: true,
          transparent: true,
          opacity: Math.min(
            1,
            numberValue(this.visual, "relationship.eventBrightness"),
          ),
        }),
      );
      object.position.copy(positions.get(event.participants[0]!)!);
    }
    if (object) {
      object.userData.start = observedAt;
      object.userData.baseOpacity =
        ((object.material as THREE.Material & { opacity?: number }).opacity ??
          1) *
        (event.type === "entity-condensed"
          ? numberValue(this.visual, "condensation.pulseIntensity")
          : 1);
      object.userData.visualSelection = {
        type: "event",
        sourceIdentity: event.eventId,
        sourceType: event.type,
        participants: event.participants,
      } satisfies VisualSelection;
      object.userData.expires =
        observedAt +
        1000 *
          (event.type === "bond-dissolved"
            ? numberValue(this.visual, "relationship.ghostDuration")
            : numberValue(this.visual, "relationship.eventDuration"));
      this.groups["phase-effects"].add(object);
      const cap = Math.min(
        numberValue(this.visual, "performance.eventCap"),
        numberValue(this.visual, "performance.maxGhosts"),
      );
      while (this.groups["phase-effects"].children.length > cap) {
        const oldest = this.groups["phase-effects"].children[0]!;
        this.groups["phase-effects"].remove(oldest);
        disposeObject(oldest);
      }
      return true;
    }
    return false;
  }
  private rebuildTransients(): void {
    const group = this.groups["phase-effects"];
    for (const child of [...group.children]) {
      if (child.userData.expires === undefined) continue;
      group.remove(child);
      disposeObject(child);
    }
    this.seenEvents.clear();
    for (const visual of this.visualEvents) {
      if (this.addTransient(visual.event, visual.observedAt))
        this.seenEvents.add(visual.event.eventId);
    }
  }
  private rebuildGrid(): void {
    clearGroup(this.groups["dimension-effects"]);
    const grid = new THREE.GridHelper(
      numberValue(this.visual, "scene.gridSize"),
      numberValue(this.visual, "scene.gridDivisions"),
      this.color(
        "Environment",
        "grid-primary",
        stringValue(this.visual, "scene.gridPrimary"),
        "grid/primary",
      ),
      this.color(
        "Environment",
        "grid-secondary",
        stringValue(this.visual, "scene.gridSecondary"),
        "grid/secondary",
      ),
    );
    const materials = Array.isArray(grid.material)
      ? grid.material
      : [grid.material];
    for (const material of materials) {
      material.transparent = true;
      material.opacity = numberValue(this.visual, "scene.gridOpacity");
    }
    this.groups["dimension-effects"].add(grid);
  }
}

function centroid(points: readonly THREE.Vector3[]): THREE.Vector3 {
  return points
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / points.length);
}
function cylinderBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments = 6,
): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      direction.length(),
      radialSegments,
      1,
      true,
    ),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return mesh;
}
function disposeObject(object: THREE.Object3D): void {
  const mesh = object as THREE.Mesh;
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) {
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((material) => material.dispose());
  }
}
function clearGroup(group: THREE.Group, disposeGeometry = true): void {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (disposeGeometry && mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }
}
