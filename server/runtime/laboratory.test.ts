import { describe, expect, it } from "vitest";
import { createGenesisState } from "../law/entities";
import { createLawV1Manifest } from "../law/manifest";
import { ExperimentRegistry } from "./laboratory";

describe("laboratory experiment registry", () => {
  it("registers modular experiments and gives them only an isolated fork", async () => {
    const registry = new ExperimentRegistry();
    registry.register({
      id: "isolation-probe",
      label: "Isolation Probe",
      async run({ fork }) {
        (fork as { tick: number }).tick = 99;
        return fork.tick;
      },
    });
    const canonical = createGenesisState(
      createLawV1Manifest("2026-08-17T00:00:00.000Z"),
    );

    expect(await registry.run("isolation-probe", canonical)).toBe(99);
    expect(canonical.tick).toBe(0);
    expect(registry.list().map(({ id }) => id)).toEqual(["isolation-probe"]);
    expect(() =>
      registry.register({
        id: "isolation-probe",
        label: "Duplicate",
        async run() {},
      }),
    ).toThrow(/Duplicate experiment/);
  });
});
