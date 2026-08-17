import { describe, expect, it } from "vitest";
import { visualControlRevealCommands } from "./VisualLabPanel";
import { visualRegistry } from "./registry";

describe("Visual Object control navigation", () => {
  it("reveals advanced controls and clears the favorites-only filter", () => {
    const parameter = visualRegistry.get("scene.pixelRatioCap");
    expect(
      visualControlRevealCommands(parameter, {
        showAdvanced: false,
        favoritesOnly: true,
      }),
    ).toEqual([
      {
        type: "visual-lab/preference/set",
        preference: "showAdvanced",
        value: true,
      },
      {
        type: "visual-lab/preference/set",
        preference: "favoritesOnly",
        value: false,
      },
    ]);
  });

  it("does not change filters when the canonical control is already visible", () => {
    expect(
      visualControlRevealCommands(visualRegistry.get("entity.scale"), {
        showAdvanced: false,
        favoritesOnly: false,
      }),
    ).toEqual([]);
  });
});
