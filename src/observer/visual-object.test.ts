import { describe, expect, it } from "vitest";
import { parseHashHex } from "../../server/law/canonical-encoding";
import type { ObservationFrame } from "./observation-types";
import {
  resolveEffectiveVisualObject,
  selectionForBond,
  selectionForEntity,
} from "./visual-object";
import { visualRegistry } from "../visual-lab/registry";
import { transformedEntityVisual } from "../visual-lab/transform";

const a = parseHashHex("ab".repeat(32)),
  b = parseHashHex("cd".repeat(32)),
  pair = parseHashHex("12".repeat(32)),
  zero = parseHashHex("00".repeat(32)),
  context = parseHashHex("56".repeat(32)),
  cluster = parseHashHex("78".repeat(32)),
  eventId = parseHashHex("90".repeat(32));
const entity = {
  hash: a,
  provenance: {
    origin: "genesis" as const,
    createdAtTick: 0 as const,
    seed: "seed1" as const,
  },
  createdAtTick: 0,
  contextHash: zero,
};
const other = {
  hash: b,
  provenance: {
    origin: "genesis" as const,
    createdAtTick: 0 as const,
    seed: "seed2" as const,
  },
  createdAtTick: 0,
  contextHash: zero,
};
const bond = {
  low: a,
  high: b,
  pairHash: pair,
  strength: 0.72,
  classification: "active-positive" as const,
};
const frame: ObservationFrame = {
  tick: 10,
  stateDigest: parseHashHex("34".repeat(32)),
  entities: [entity, other],
  bonds: [bond],
  clusters: [],
  condensationRecords: [],
};

describe("effective visual object state", () => {
  it("explains effective entity appearance and palette causality", () => {
    const values = {
      ...visualRegistry.defaults(),
      "palette.enabled": true,
      "palette.active": "aurora",
    };
    const state = resolveEffectiveVisualObject(
      frame,
      selectionForEntity(entity),
      values,
    )!;
    expect(state.type).toBe("entity");
    expect(state.palette).toMatchObject({
      colorMode: "Palette",
      activePaletteId: "aurora",
      semanticRole: "Entity",
      status: "APPLIED",
    });
    expect(state.attributes.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "color",
        "size",
        "shape",
        "smoothness",
        "opacity",
        "emission",
        "position",
      ]),
    );
    expect(state.relevantControlIds).toContain("palette.active");
  });
  it("reports legacy palette gating directly", () => {
    const state = resolveEffectiveVisualObject(
      frame,
      selectionForEntity(entity),
      visualRegistry.defaults(),
    )!;
    expect(state.palette.status).toBe("NOT APPLIED");
    expect(state.palette.reason).toBe("Color Mode is Legacy Colors");
  });
  it("reports relevant global effects even when they are off or gated", () => {
    const off = resolveEffectiveVisualObject(
      frame,
      selectionForEntity(entity),
      { ...visualRegistry.defaults(), "scene.fogEnabled": false },
    )!;
    expect(off.effects.find(({ id }) => id === "bloom")?.status).toBe("OFF");
    expect(off.effects.find(({ id }) => id === "depth-of-field")?.status).toBe(
      "OFF",
    );
    expect(off.effects.find(({ id }) => id === "fog")?.status).toBe("OFF");

    const gatedFog = resolveEffectiveVisualObject(
      frame,
      selectionForEntity(entity),
      {
        ...visualRegistry.defaults(),
        "scene.fogEnabled": true,
        "scene.fogType": "none",
      },
    )!;
    expect(gatedFog.effects.find(({ id }) => id === "fog")).toMatchObject({
      status: "BLOCKED",
      reasons: ["Fog type is none"],
    });
  });
  it("explains relationships with effective palette color and thickness", () => {
    const values = {
      ...visualRegistry.defaults(),
      "palette.enabled": true,
      "palette.active": "monochrome",
    };
    const state = resolveEffectiveVisualObject(
      frame,
      selectionForBond(bond),
      values,
    )!;
    expect(state.type).toBe("positive-relationship");
    expect(
      state.attributes.find(({ id }) => id === "thickness")?.effectiveValue,
    ).toBeTypeOf("number");
    expect(state.palette.semanticRole).toBe("Positive Relationship");
  });
  it("measures selective bloom as invisible when projected contribution is subpixel", () => {
    const values = {
      ...visualRegistry.defaults(),
      "vfx.selective.enabled": true,
      "vfx.selective.target": "Entities",
    };
    const state = resolveEffectiveVisualObject(
      frame,
      selectionForEntity(entity),
      values,
      {
        measurements: {
          rendererSupported: true,
          postprocessingActive: true,
          cameraDistance: 82.4,
          projectedDiameterPx: 0.6,
        },
      },
    )!;
    const bloom = state.effects.find(({ id }) => id === "selective-bloom")!;
    expect(bloom.status).toBe("INVISIBLE");
    expect(bloom.reasons.join(" ")).toContain("0.6 px");
  });
  it("palette switches change current resolved entity color", () => {
    const base = visualRegistry.defaults(),
      aurora = transformedEntityVisual(entity, {
        ...base,
        "palette.enabled": true,
        "palette.active": "aurora",
      }).finalColor,
      mono = transformedEntityVisual(entity, {
        ...base,
        "palette.enabled": true,
        "palette.active": "monochrome",
      }).finalColor;
    expect(aurora).not.toBe(mono);
  });
  it("gives every exposed attribute a deterministic source and valid control path", () => {
    for (const selection of [
      selectionForEntity(entity),
      selectionForBond(bond),
    ]) {
      const state = resolveEffectiveVisualObject(
        frame,
        selection,
        visualRegistry.defaults(),
      )!;
      for (const attribute of state.attributes) {
        expect(attribute.source.length).toBeGreaterThan(0);
        for (const id of attribute.controllingSettingIds)
          expect(() => visualRegistry.get(id)).not.toThrow();
      }
    }
  });
  it("resolves every renderer-selectable source type against a real observed source", () => {
    const contextual = {
      ...frame,
      entities: [
        { ...entity, contextHash: context, clusterHash: cluster },
        { ...other, clusterHash: cluster },
      ],
      clusters: [{ clusterHash: cluster, memberHashes: [a, b] }],
      condensationRecords: [
        { entityHash: a, createdAtTick: 9, parentHashes: [a, b] },
      ],
    };
    const event = {
      eventId,
      tick: 9,
      type: "entity-condensed" as const,
      participants: [a],
    };
    const selections = [
      {
        type: "cluster" as const,
        sourceIdentity: cluster,
        sourceType: "Cluster",
      },
      {
        type: "context" as const,
        sourceIdentity: context,
        sourceType: "Context",
        entityHash: a,
      },
      {
        type: "condensed-entity" as const,
        sourceIdentity: a,
        sourceType: "Condensed Entity",
        entityHash: a,
      },
      {
        type: "event" as const,
        sourceIdentity: eventId,
        sourceType: event.type,
        participants: [a],
      },
      {
        type: "particle-field-source" as const,
        sourceIdentity: a,
        sourceType: "Particle Field source",
        entityHash: a,
      },
      {
        type: "vortex-field-source" as const,
        sourceIdentity: a,
        sourceType: "Vortex Field source",
        entityHash: a,
      },
    ];
    for (const selection of selections)
      expect(
        resolveEffectiveVisualObject(
          contextual,
          selection,
          visualRegistry.defaults(),
          { events: [event] },
        ),
        selection.type,
      ).toBeDefined();
    expect(
      resolveEffectiveVisualObject(
        contextual,
        { type: "cluster", sourceIdentity: zero, sourceType: "Cluster" },
        visualRegistry.defaults(),
      ),
    ).toBeUndefined();
  });
  it("diagnoses deterministic particle and vortex budget exclusion for a selected source", () => {
    const values = {
      ...visualRegistry.defaults(),
      "vfx.particleField.enabled": true,
      "vfx.particleField.quality": "High",
      "vfx.particleField.perTarget": 8,
      "vfx.particleField.globalBudget": 1,
      "vfx.vortexField.enabled": true,
      "vfx.vortexField.maxFields": 1,
    };
    const state = resolveEffectiveVisualObject(
      frame,
      selectionForEntity(other),
      values,
    )!;
    expect(
      state.effects.find(({ id }) => id === "particleField"),
    ).toMatchObject({ status: "BLOCKED" });
    expect(state.effects.find(({ id }) => id === "vortexField")).toMatchObject({
      status: "BLOCKED",
    });
  });
});
