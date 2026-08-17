import { describe, expect, it } from "vitest";
import {
  ActivityBuffer,
  activityForCommand,
  formatActivityCli,
  formatActivityLine,
  serializeActivityJson,
} from "./activity-events";
import { McpSocket } from "../../server/mcp/mcp-socket";
import type { RuntimePort } from "../runtime/runtime-port";

describe("structured observer activity", () => {
  it("retains a bounded sequence and clears without touching another state system", () => {
    const buffer = new ActivityBuffer(
      3,
      () => new Date("2026-08-16T23:41:08.000Z"),
    );
    for (let index = 0; index < 5; index += 1)
      buffer.append({
        category: "SYSTEM",
        level: "info",
        action: "TEST",
        message: `event ${index}`,
        origin: "system",
      });
    expect(buffer.snapshot().map(({ sequence }) => sequence)).toEqual([
      3, 4, 5,
    ]);
    expect(buffer.snapshot().map(({ message }) => message)).toEqual([
      "event 2",
      "event 3",
      "event 4",
    ]);
    buffer.clear();
    expect(buffer.snapshot()).toEqual([]);
  });

  it("formats clean CLI text and bounded structured JSON", () => {
    const buffer = new ActivityBuffer(
      10,
      () => new Date("2026-08-16T23:41:08.000Z"),
    );
    const event = buffer.append({
      category: "PALETTE",
      level: "error",
      action: "IMPORT",
      message: "import failed: invalid semantic role",
      origin: "human-ui",
      data: { path: "palette.roles.foo" },
    });
    expect(formatActivityLine(event)).toBe(
      "[23:41:08] PALETTE   ERROR import failed: invalid semantic role",
    );
    expect(formatActivityCli([event])).not.toContain("[object Object]");
    expect(JSON.parse(serializeActivityJson([event]))).toEqual([event]);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(
      buffer.append({
        category: "SYSTEM",
        level: "warning",
        action: "SAFE",
        message: "safe data",
        origin: "system",
        data: circular,
      }).data,
    ).toEqual({ self: "[circular]" });
    const bounded = buffer.append({
      category: "SYSTEM",
      level: "warning",
      action: "A".repeat(200),
      message: "M".repeat(3_000),
      origin: "machine",
    });
    expect(bounded.action).toHaveLength(100);
    expect(bounded.message).toHaveLength(2_000);
  });

  it("turns shared commands and failures into meaningful events", () => {
    expect(
      activityForCommand(
        { type: "visual-lab/value/set", id: "vfx.bloom.strength", value: 2.75 },
        { ok: true },
        "human-ui",
      ),
    ).toMatchObject({
      category: "VFX",
      action: "SET",
      message: "vfx.bloom.strength → 2.75",
    });
    expect(
      activityForCommand(
        { type: "saves/save-current" },
        { ok: true, message: "Saved tick 4182000" },
        "machine",
      ),
    ).toMatchObject({
      category: "SAVE",
      origin: "machine",
      message: "Saved tick 4182000",
    });
    expect(
      activityForCommand(
        { type: "visual-lab/palette/import", json: "{}" },
        {
          ok: false,
          message: "Invalid semantic role “foo” at palette.roles.foo",
        },
        "human-ui",
      ),
    ).toMatchObject({
      category: "PALETTE",
      level: "error",
      action: "IMPORT",
      message:
        "import failed: Invalid semantic role “foo” at palette.roles.foo",
    });
  });

  it("marks commands entering through the machine socket with machine origin", async () => {
    let origin = "";
    const runtime: RuntimePort = {
      command: async (_command, nextOrigin) => {
        origin = nextOrigin ?? "";
        return { ok: true };
      },
      query: async () => ({ ok: true }),
    };
    await new McpSocket(runtime).command({
      type: "time/set-running",
      running: true,
    });
    expect(origin).toBe("machine");
  });

  it("has no render-frame or universe-tick ingestion API", () => {
    const buffer = new ActivityBuffer();
    expect(Object.keys(buffer)).not.toContain("frame");
    expect(buffer.snapshot()).toHaveLength(0);
  });
});
