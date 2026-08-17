import { describe, expect, it } from "vitest";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { parseHashHex } from "../../server/law/canonical-encoding";
import { visualRegistry } from "../visual-lab/registry";
import type { ObservationFrame } from "./observation-types";
import { applyOrbitConfiguration, visualTargetCount } from "./SceneObserver";

describe("viewport auto orbit", () => {
  it("updates the existing OrbitControls configuration and stops immediately when disabled", () => {
    const controls = {
      enableDamping: false,
      dampingFactor: 0,
      rotateSpeed: 0,
      panSpeed: 0,
      zoomSpeed: 0,
      autoRotate: false,
      autoRotateSpeed: 0,
    } as Pick<
      OrbitControls,
      | "enableDamping"
      | "dampingFactor"
      | "rotateSpeed"
      | "panSpeed"
      | "zoomSpeed"
      | "autoRotate"
      | "autoRotateSpeed"
    >;
    const values = visualRegistry.defaults();
    applyOrbitConfiguration(controls, {
      ...values,
      "camera.autoRotate": true,
      "camera.autoRotateSpeed": 7,
    });
    expect(controls.autoRotate).toBe(true);
    expect(controls.autoRotateSpeed).toBe(7);
    applyOrbitConfiguration(controls, {
      ...values,
      "camera.autoRotate": false,
    });
    expect(controls.autoRotate).toBe(false);
  });

  it("counts current event targets and requires an entity selection", () => {
    const frame: ObservationFrame = {
      tick: 0,
      stateDigest: parseHashHex("11".repeat(32)),
      entities: [],
      bonds: [],
      clusters: [],
      condensationRecords: [],
    };
    expect(visualTargetCount(frame, "Events", false, 3)).toBe(3);
    expect(visualTargetCount(frame, "Selected Entity", false, 3)).toBe(0);
    expect(visualTargetCount(frame, "Selected Entity", true, 0)).toBe(1);
  });
});
