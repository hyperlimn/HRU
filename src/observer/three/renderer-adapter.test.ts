import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { parseHashHex } from "../../../server/law/canonical-encoding";
import { renderChannels } from "../render-channels";
import {
  InstanceSelectionMap,
  ThreeObservationRenderer,
  applyChannelVisibility,
} from "./renderer-adapter";
import { visualRegistry } from "../../visual-lab/registry";
import type { ObservationFrame } from "../observation-types";
import { sameVisualSelection, selectionForEntity } from "../visual-object";
import { transformedEntityVisual } from "../../visual-lab/transform";

describe("renderer adapter boundaries", () => {
  it("applies render-channel state to scene groups", () => {
    const groups = Object.fromEntries(
      renderChannels.map((channel) => [channel.id, new THREE.Group()]),
    ) as unknown as Parameters<typeof applyChannelVisibility>[0];
    const channels = Object.fromEntries(
      renderChannels.map((channel) => [channel.id, channel.id === "entities"]),
    ) as Parameters<typeof applyChannelVisibility>[1];
    applyChannelVisibility(groups, channels);
    expect(groups.entities.visible).toBe(true);
    expect(groups["positive-bonds"].visible).toBe(false);
  });
  it("maps an instanced selection to the correct visual source", () => {
    const map = new InstanceSelectionMap();
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(),
      new THREE.MeshBasicMaterial(),
      2,
    );
    const hash = parseHashHex("ab".repeat(32));
    const selection = selectionForEntity({
      hash,
      provenance: { origin: "genesis", createdAtTick: 0, seed: "seed1" },
      createdAtTick: 0,
      contextHash: parseHashHex("00".repeat(32)),
    });
    map.set(mesh, 1, selection);
    expect(map.get(mesh, 1)).toEqual(selection);
    expect(map.get(mesh, 0)).toBeUndefined();
  });
  it("distinguishes context visuals that share a stable context hash", () => {
    const context = parseHashHex("ab".repeat(32));
    expect(
      sameVisualSelection(
        {
          type: "context",
          sourceIdentity: context,
          sourceType: "Context",
          entityHash: "first",
        },
        {
          type: "context",
          sourceIdentity: context,
          sourceType: "Context",
          entityHash: "second",
        },
      ),
    ).toBe(false);
  });
  it("applies material settings without geometry rebuild and rebuilds only for geometry detail", () => {
    const adapter = new ThreeObservationRenderer(new THREE.Scene());
    const base = visualRegistry.defaults();
    expect(
      adapter.setVisualConfiguration({ ...base, "scene.exposure": 2 })
        .geometryRebuilt,
    ).toBe(false);
    const revision = adapter.debugGeometryRevision();
    expect(
      adapter.setVisualConfiguration({ ...base, "entity.geometryDetail": 2 })
        .geometryRebuilt,
    ).toBe(true);
    expect(adapter.debugGeometryRevision()).toBe(revision + 1);
    adapter.dispose();
  });
  it("reconstructs grid resources in place without accumulating scene objects", () => {
    const scene = new THREE.Scene();
    const adapter = new ThreeObservationRenderer(scene);
    const base = visualRegistry.defaults();
    for (let size = 31; size < 41; size += 1)
      adapter.setVisualConfiguration({ ...base, "scene.gridSize": size });
    expect(
      scene.getObjectByName("observation:dimension-effects")?.children,
    ).toHaveLength(1);
    expect(
      scene.children.filter((child) => child.name.startsWith("observation:")),
    ).toHaveLength(renderChannels.length);
    adapter.dispose();
    expect(
      scene.children.filter((child) => child.name.startsWith("observation:")),
    ).toHaveLength(0);
  });
  it("does not rebuild procedural geometry for unrelated camera settings", () => {
    const scene = new THREE.Scene();
    const adapter = new ThreeObservationRenderer(scene);
    const base = {
      ...visualRegistry.defaults(),
      "vfx.particleField.enabled": true,
      "vfx.particleField.perTarget": 4,
    };
    const hash = parseHashHex("ab".repeat(32));
    const zero = parseHashHex("00".repeat(32));
    const frame: ObservationFrame = {
      tick: 0,
      stateDigest: parseHashHex("66".repeat(32)),
      entities: [
        {
          hash,
          provenance: { origin: "genesis", createdAtTick: 0, seed: "seed1" },
          createdAtTick: 0,
          contextHash: zero,
        },
      ],
      bonds: [],
      clusters: [],
      condensationRecords: [],
    };

    adapter.setVisualConfiguration(base);
    adapter.update(frame, []);
    const points = scene.getObjectByName("vfx:particle-field") as THREE.Points;
    const geometry = points.geometry;

    adapter.setVisualConfiguration({ ...base, "camera.fov": 70 });
    expect(
      (scene.getObjectByName("vfx:particle-field") as THREE.Points).geometry,
    ).toBe(geometry);

    adapter.setVisualConfiguration({ ...base, "vfx.particleField.radius": 2 });
    expect(
      (scene.getObjectByName("vfx:particle-field") as THREE.Points).geometry,
    ).not.toBe(geometry);
    adapter.dispose();
  });
  it("renders each entity's resolved hash-derived emission", () => {
    const scene = new THREE.Scene();
    const adapter = new ThreeObservationRenderer(scene);
    const baseHash = "ab".repeat(32);
    const lowHash = parseHashHex(
      `${baseHash.slice(0, 8)}0000${baseHash.slice(12)}`,
    );
    const highHash = parseHashHex(
      `${baseHash.slice(0, 8)}ffff${baseHash.slice(12)}`,
    );
    const zero = parseHashHex("00".repeat(32));
    const entities = [lowHash, highHash].map((hash, index) => ({
      hash,
      provenance: {
        origin: "genesis" as const,
        createdAtTick: 0 as const,
        seed: index === 0 ? ("seed1" as const) : ("seed2" as const),
      },
      createdAtTick: 0,
      contextHash: zero,
    }));
    const frame: ObservationFrame = {
      tick: 0,
      stateDigest: parseHashHex("77".repeat(32)),
      entities,
      bonds: [],
      clusters: [],
      condensationRecords: [],
    };
    const values = {
      ...visualRegistry.defaults(),
      "entity.emissiveMultiplier": 2,
      "entity.brightness": 1.5,
    };

    adapter.setVisualConfiguration(values);
    adapter.update(frame, []);

    const actual = scene
      .getObjectByName("observation:entities")!
      .children.filter((child) => child instanceof THREE.InstancedMesh)
      .map(
        (child) =>
          (child as THREE.InstancedMesh).material as THREE.MeshStandardMaterial,
      )
      .map(({ emissiveIntensity }) => emissiveIntensity)
      .sort((left, right) => left - right);
    const expected = entities
      .map((entity) => transformedEntityVisual(entity, values).emissive)
      .sort((left, right) => left - right);
    expect(actual).toEqual(expected);
    adapter.dispose();
  });
  it("rebuilds hash-smoothness geometries without retaining obsolete cached resources", () => {
    const scene = new THREE.Scene(),
      adapter = new ThreeObservationRenderer(scene),
      base = visualRegistry.defaults();
    const low = parseHashHex(`${"ab".repeat(18)}00000000${"cd".repeat(10)}`),
      high = parseHashHex(`${"ab".repeat(18)}ffffffff${"cd".repeat(10)}`),
      zero = parseHashHex("00".repeat(32));
    const frame: ObservationFrame = {
      tick: 0,
      stateDigest: parseHashHex("11".repeat(32)),
      entities: [
        {
          hash: low,
          provenance: { origin: "genesis", createdAtTick: 0, seed: "seed1" },
          createdAtTick: 0,
          contextHash: zero,
        },
        {
          hash: high,
          provenance: { origin: "genesis", createdAtTick: 0, seed: "seed2" },
          createdAtTick: 0,
          contextHash: zero,
        },
      ],
      bonds: [],
      clusters: [],
      condensationRecords: [],
    };
    adapter.setVisualConfiguration(base);
    adapter.update(frame, []);
    expect(adapter.debugEntityGeometryCount()).toBe(2);
    for (let maximum = 2; maximum <= 5; maximum += 1)
      adapter.setVisualConfiguration({
        ...base,
        "entity.maxHashSmoothness": maximum,
      });
    expect(adapter.debugEntityGeometryCount()).toBeLessThanOrEqual(2);
    adapter.dispose();
    expect(
      scene.children.filter((child) => child.name.startsWith("observation:")),
    ).toHaveLength(0);
  });
  it("repeated selection replaces its highlight without accumulating Three.js resources", () => {
    const scene = new THREE.Scene(),
      adapter = new ThreeObservationRenderer(scene),
      base = visualRegistry.defaults(),
      hash = parseHashHex("ab".repeat(32)),
      zero = parseHashHex("00".repeat(32)),
      frame: ObservationFrame = {
        tick: 0,
        stateDigest: parseHashHex("22".repeat(32)),
        entities: [
          {
            hash,
            provenance: { origin: "genesis", createdAtTick: 0, seed: "seed1" },
            createdAtTick: 0,
            contextHash: zero,
          },
        ],
        bonds: [],
        clusters: [],
        condensationRecords: [],
      };
    adapter.setVisualConfiguration(base);
    adapter.update(frame, []);
    for (let index = 0; index < 20; index++)
      adapter.setSelection(index % 2 ? hash : undefined);
    expect(
      scene.getObjectByName("observation:entities")?.children.length,
    ).toBeLessThanOrEqual(2);
    adapter.dispose();
  });
  it("dims only unselected entity materials", () => {
    const scene = new THREE.Scene();
    const adapter = new ThreeObservationRenderer(scene);
    const first = parseHashHex("ab".repeat(32));
    const second = parseHashHex("cd".repeat(32));
    const zero = parseHashHex("00".repeat(32));
    const frame: ObservationFrame = {
      tick: 0,
      stateDigest: parseHashHex("88".repeat(32)),
      entities: [
        {
          hash: first,
          provenance: { origin: "genesis", createdAtTick: 0, seed: "seed1" },
          createdAtTick: 0,
          contextHash: zero,
        },
        {
          hash: second,
          provenance: { origin: "genesis", createdAtTick: 0, seed: "seed2" },
          createdAtTick: 0,
          contextHash: zero,
        },
      ],
      bonds: [],
      clusters: [],
      condensationRecords: [],
    };
    adapter.setVisualConfiguration({
      ...visualRegistry.defaults(),
      "selection.dimUnselected": 0.6,
    });
    adapter.update(frame, []);
    adapter.setSelection(first);

    const meshes = scene
      .getObjectByName("observation:entities")!
      .children.filter((child) => child instanceof THREE.InstancedMesh);
    const selected = meshes.find(({ userData }) => userData.containsSelected)!;
    const unselected = meshes.find(
      ({ userData }) => !userData.containsSelected,
    )!;
    expect(
      ((selected as THREE.InstancedMesh).material as THREE.Material).opacity,
    ).toBe(1);
    expect(
      ((unselected as THREE.InstancedMesh).material as THREE.Material).opacity,
    ).toBeCloseTo(0.4);
    adapter.dispose();
  });
  it("reports expired transient selections as their resources are disposed", () => {
    const scene = new THREE.Scene();
    const adapter = new ThreeObservationRenderer(scene);
    const hash = parseHashHex("ab".repeat(32));
    const zero = parseHashHex("00".repeat(32));
    const eventId = parseHashHex("99".repeat(32));
    const frame: ObservationFrame = {
      tick: 0,
      stateDigest: parseHashHex("aa".repeat(32)),
      entities: [
        {
          hash,
          provenance: { origin: "genesis", createdAtTick: 0, seed: "seed1" },
          createdAtTick: 0,
          contextHash: zero,
        },
      ],
      bonds: [],
      clusters: [],
      condensationRecords: [],
    };
    adapter.setVisualConfiguration(visualRegistry.defaults());
    adapter.update(frame, [
      {
        observedAt: 0,
        event: {
          eventId,
          tick: 0,
          type: "entity-injected",
          participants: [hash],
        },
      },
    ]);

    expect(adapter.animate(3_000)).toContainEqual({
      type: "event",
      sourceIdentity: eventId,
      sourceType: "entity-injected",
      participants: [hash],
    });
    expect(
      scene
        .getObjectByName("observation:phase-effects")!
        .children.some(
          (child) => child.userData.visualSelection?.sourceIdentity === eventId,
        ),
    ).toBe(false);
    adapter.dispose();
  });
  it("recolors current entity instances and relationship materials when the active palette changes", () => {
    const scene = new THREE.Scene(),
      adapter = new ThreeObservationRenderer(scene),
      base = visualRegistry.defaults(),
      a = parseHashHex("ab".repeat(32)),
      b = parseHashHex("cd".repeat(32)),
      zero = parseHashHex("00".repeat(32)),
      frame: ObservationFrame = {
        tick: 0,
        stateDigest: parseHashHex("33".repeat(32)),
        entities: [
          {
            hash: a,
            provenance: { origin: "genesis", createdAtTick: 0, seed: "seed1" },
            createdAtTick: 0,
            contextHash: zero,
          },
          {
            hash: b,
            provenance: { origin: "genesis", createdAtTick: 0, seed: "seed2" },
            createdAtTick: 0,
            contextHash: zero,
          },
        ],
        bonds: [
          {
            low: a,
            high: b,
            pairHash: parseHashHex("12".repeat(32)),
            strength: 0.8,
            classification: "active-positive",
          },
        ],
        clusters: [],
        condensationRecords: [],
      };
    adapter.setVisualConfiguration({
      ...base,
      "palette.enabled": true,
      "palette.active": "hru-default",
    });
    adapter.update(frame, [
      {
        observedAt: performance.now(),
        event: {
          eventId: parseHashHex("44".repeat(32)),
          tick: 0,
          type: "entity-injected",
          participants: [a],
        },
      },
    ]);
    const entityColor = (group: THREE.Object3D) => {
        const mesh = group.children.find(
            (child) => child instanceof THREE.InstancedMesh,
          ) as THREE.InstancedMesh,
          color = new THREE.Color();
        mesh.getColorAt(0, color);
        return color.getHexString();
      },
      relationshipColor = (group: THREE.Object3D) =>
        (
          (group.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
        ).color.getHexString(),
      eventColor = (group: THREE.Object3D) =>
        (
          (
            group.children.find(
              (child) => child.userData.visualSelection?.type === "event",
            ) as THREE.Mesh
          ).material as THREE.MeshBasicMaterial
        ).color.getHexString(),
      gridColor = (group: THREE.Object3D) => {
        const colors = (
          group.children[0] as THREE.LineSegments
        ).geometry.getAttribute("color");
        return [colors.getX(0), colors.getY(0), colors.getZ(0)].join(":");
      },
      entities = scene.getObjectByName("observation:entities")!,
      relationships = scene.getObjectByName("observation:positive-bonds")!,
      events = scene.getObjectByName("observation:phase-effects")!,
      grid = scene.getObjectByName("observation:dimension-effects")!,
      beforeEntity = entityColor(entities),
      beforeRelationship = relationshipColor(relationships),
      beforeEvent = eventColor(events),
      beforeGrid = gridColor(grid);
    adapter.setVisualConfiguration({
      ...base,
      "palette.enabled": true,
      "palette.active": "aurora",
    });
    expect(entityColor(entities)).not.toBe(beforeEntity);
    expect(relationshipColor(relationships)).not.toBe(beforeRelationship);
    expect(eventColor(events)).not.toBe(beforeEvent);
    expect(gridColor(grid)).not.toBe(beforeGrid);
    adapter.dispose();
  });
  it("recolors live materials from an explicitly supplied custom palette", () => {
    const scene = new THREE.Scene(),
      adapter = new ThreeObservationRenderer(scene),
      base = visualRegistry.defaults(),
      hash = parseHashHex("ab".repeat(32)),
      zero = parseHashHex("00".repeat(32)),
      frame: ObservationFrame = {
        tick: 0,
        stateDigest: parseHashHex("55".repeat(32)),
        entities: [
          {
            hash,
            provenance: { origin: "genesis", createdAtTick: 0, seed: "seed1" },
            createdAtTick: 0,
            contextHash: zero,
          },
        ],
        bonds: [],
        clusters: [],
        condensationRecords: [],
      };
    adapter.setVisualConfiguration({
      ...base,
      "palette.enabled": true,
      "palette.active": "custom-renderer",
    });
    adapter.update(frame, []);
    const group = scene.getObjectByName("observation:entities")!,
      mesh = () =>
        group.children.find(
          (child) => child instanceof THREE.InstancedMesh,
        ) as THREE.InstancedMesh,
      color = new THREE.Color();
    mesh().getColorAt(0, color);
    const fallback = color.getHexString();
    adapter.setPaletteLibrary([
      {
        id: "custom-renderer",
        name: "Custom Renderer",
        colors: ["#010203", "#fefdfc"],
        roles: { Entity: [0] },
        builtIn: false,
      },
    ]);
    mesh().getColorAt(0, color);
    expect(color.getHexString()).not.toBe(fallback);
    adapter.dispose();
  });
});
