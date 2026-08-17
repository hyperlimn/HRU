import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("global palette architectural guard", () => {
  it("routes every direct Three.js observer material color through the shared resolver", async () => {
    const source = await readFile(
      join(process.cwd(), "src/observer/three/renderer-adapter.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/color:\s*stringValue\(/);
    for (const role of [
      "Entity",
      "Glow",
      "Positive Relationship",
      "Weak Relationship",
      "Repulsion",
      "Cluster",
      "Context",
      "Condensed Entity",
      "Event",
      "Selection",
      "Accent",
    ]) {
      expect(source).toMatch(new RegExp(`["']${role}["']`));
    }
  });

  it("routes environment colors through palette helpers", async () => {
    const source = await readFile(
      join(process.cwd(), "src/observer/SceneObserver.tsx"),
      "utf8",
    );
    expect(source).toMatch(/paletteColor\(\s*values,\s*["']Background["']/);
    expect(source).toMatch(
      /paletteChannelColor\(\s*values,\s*["']Environment["']/,
    );
  });
});
