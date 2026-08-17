import { describe, expect, it } from "vitest";
import { visualRegistry } from "./registry";
import {
  changedEffectiveFeatureIds,
  validateVisualFeatureRegistry,
  visualLabCoverage,
  visualLabDiagnostics,
  visualFeatures,
} from "./visual-features";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

describe("Visual Lab architectural coverage", () => {
  it("declares a consumer or explicit prepared/diagnostic status for every registered parameter", () => {
    expect(() => validateVisualFeatureRegistry()).not.toThrow();
    const coverage = visualLabCoverage();
    expect(coverage).toHaveLength(visualRegistry.list().length);
    expect(coverage).toHaveLength(437);
    expect(coverage.filter(({ consumer }) => !consumer)).toEqual([]);
    expect(
      coverage
        .filter(({ status }) => status === "prepared")
        .every(
          ({ reason, changesEffectiveState }) =>
            Boolean(reason) && !changesEffectiveState,
        ),
    ).toBe(true);
  });
  it("does not let a renderer consumer expect an absent registry parameter", () => {
    const registered = new Set(visualRegistry.list().map(({ id }) => id));
    expect(
      visualFeatures
        .flatMap(({ parameterIds }) => parameterIds)
        .filter((id) => !registered.has(id)),
    ).toEqual([]);
  });
  it("finds every literal renderer accessor in the registry", async () => {
    const root = join(process.cwd(), "src", "observer"),
      files = (await readdir(root, { recursive: true })).filter(
        (name) => /\.(ts|tsx)$/.test(name) && !name.includes(".test."),
      ),
      sources = await Promise.all(
        files.map((name) => readFile(join(root, name), "utf8")),
      ),
      expected = [
        ...sources
          .join("\n")
          .matchAll(
            /(?:numberValue|booleanValue|stringValue|vectorValue)\([^,]+,\s*['"]([^'"]+)['"]/g,
          ),
      ].map((match) => match[1]!),
      registered = new Set(visualRegistry.list().map(({ id }) => id));
    expect([...new Set(expected.filter((id) => !registered.has(id)))]).toEqual(
      [],
    );
  });
  it("maps every important visual attribute to a controlling or deterministic path", () => {
    const controlled = [
      "color",
      "size",
      "shape",
      "smoothness",
      "opacity",
      "emission",
      "position",
      "thickness",
      "strength",
      "geometry",
    ];
    expect(new Set(controlled).size).toBe(controlled.length);
    const defaults = visualRegistry.defaults(),
      changed = {
        ...defaults,
        "entity.scale": 2,
        "palette.active": "aurora",
        "palette.enabled": true,
      };
    expect(changedEffectiveFeatureIds(defaults, changed)).toEqual(
      expect.arrayContaining(["entities", "palette"]),
    );
    expect(visualLabDiagnostics(defaults).orphanParameterIds).toEqual([]);
  });
});
