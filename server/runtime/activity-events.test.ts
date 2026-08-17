import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "../../src/activity/activity-events";
import { createGenesisState } from "../law/entities";
import { createLawV1Manifest } from "../law/manifest";
import { VisualLabService } from "../visual-lab/service";
import { AuthoritativeRuntime } from "./authoritative-runtime";
import { SimulationWorkerHost } from "./simulation-worker-host";

describe("runtime activity routing", () => {
  it("emits shared command successes and errors, but not summary ticks or observer polling", async () => {
    const root = await mkdtemp(join(tmpdir(), "hru-activity-runtime-"));
    const manifest = createLawV1Manifest("2026-08-17T00:00:00.000Z");
    const worker = new SimulationWorkerHost();
    const initial = await worker.start(createGenesisState(manifest));
    const visualLab = await VisualLabService.create(
      join(root, "visual-lab.json"),
    );
    const runtime = new AuthoritativeRuntime(
      worker,
      initial,
      manifest,
      join(root, "saves"),
      visualLab,
    );
    const events: ActivityEvent[] = [];
    runtime.on("activity", (event) => events.push(event as ActivityEvent));
    try {
      runtime.start();
      for (let index = 0; index < 5; index += 1)
        await runtime.query({ type: "observation/frame" });
      expect(events).toEqual([]);

      await runtime.command(
        { type: "time/set-multiplier", multiplier: 1000 },
        "machine",
      );
      expect(events.at(-1)).toMatchObject({
        category: "SPEED",
        level: "info",
        origin: "machine",
        message: "multiplier → 1000×",
      });

      await runtime.command(
        {
          type: "visual-lab/palette/import",
          json: JSON.stringify({
            id: "bad-role",
            name: "Bad Role",
            colors: ["#112233", "#abcdef"],
            roles: { foo: [0] },
            builtIn: false,
          }),
        },
        "human-ui",
      );
      expect(events.at(-1)).toMatchObject({
        category: "PALETTE",
        level: "error",
        origin: "human-ui",
        message:
          "import failed: Invalid semantic role “foo” at palette.roles.foo",
      });
    } finally {
      runtime.stop();
      await worker.stop();
      await rm(root, { recursive: true, force: true });
    }
  });
});
