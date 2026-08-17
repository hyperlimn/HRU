import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { paletteHash, type Palette } from "../../src/visual-lab/palettes";
import { VisualLabService } from "./service";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

async function service() {
  const root = await mkdtemp(join(tmpdir(), "hru-palette-import-"));
  roots.push(root);
  return VisualLabService.create(join(root, "visual-lab.json"));
}

describe("palette import round-trip", () => {
  it("exports, imports, validates, selects, persists, and immediately exposes the imported palette", async () => {
    const visualLab = await service();
    const exported = await visualLab.execute({
      type: "visual-lab/palette/export",
      id: "aurora",
    });
    const source = JSON.parse(String(exported.data)) as Palette;
    const imported = await visualLab.execute({
      type: "visual-lab/palette/import",
      json: String(exported.data),
    });
    expect(imported).toMatchObject({
      ok: true,
      message: expect.stringContaining("aurora-imported"),
    });
    expect(visualLab.state().values["palette.active"]).toBe("aurora-imported");
    expect(visualLab.state().values["palette.enabled"]).toBe(true);
    const palettes = visualLab.query({ type: "visual-lab/palettes/list" })
      .data as readonly (Palette & { hash: string })[];
    const selected = palettes.find(({ id }) => id === "aurora-imported");
    expect(selected?.name).toBe("Aurora (Imported)");
    expect(selected?.hash).toBe(paletteHash(source));
    const restarted = await VisualLabService.create(
      join(roots[0]!, "visual-lab.json"),
    );
    expect(restarted.state().values["palette.active"]).toBe("aurora-imported");
  });

  it("resolves repeated ID conflicts predictably and visibly", async () => {
    const visualLab = await service();
    const exported = await visualLab.execute({
      type: "visual-lab/palette/export",
      id: "aurora",
    });
    await visualLab.execute({
      type: "visual-lab/palette/import",
      json: String(exported.data),
    });
    const second = await visualLab.execute({
      type: "visual-lab/palette/import",
      json: String(exported.data),
    });
    expect(second).toMatchObject({
      ok: true,
      message: expect.stringContaining("aurora-imported-2"),
    });
    expect(visualLab.state().values["palette.active"]).toBe(
      "aurora-imported-2",
    );
  });

  it("rejects parse and semantic-role errors without changing the active palette", async () => {
    const visualLab = await service();
    const original = visualLab.state().values["palette.active"];
    expect(
      await visualLab.execute({
        type: "visual-lab/palette/import",
        json: "{nope",
      }),
    ).toEqual({ ok: false, message: "Palette import is not valid JSON" });
    const invalidRole = JSON.stringify({
      id: "role-test",
      name: "Role Test",
      colors: ["#112233", "#abcdef"],
      roles: { foo: [0] },
      builtIn: false,
    });
    expect(
      await visualLab.execute({
        type: "visual-lab/palette/import",
        json: invalidRole,
      }),
    ).toEqual({
      ok: false,
      message: "Invalid semantic role “foo” at palette.roles.foo",
    });
    expect(visualLab.state().values["palette.active"]).toBe(original);
  });
});
