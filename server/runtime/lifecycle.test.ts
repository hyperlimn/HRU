import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { startRuntimeStack } from "../index";
import { CommandRouter } from "../commands/command-router";
import type { RuntimePort } from "../../src/runtime/runtime-port";
import { RuntimeWebSocketServer } from "../websocket/websocket-server";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});

const listen = (server: ReturnType<typeof createServer>) =>
  new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        reject(new Error("Expected an ephemeral TCP port"));
      else resolve(address.port);
    });
  });
const close = (server: ReturnType<typeof createServer>) =>
  new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );

describe("runtime lifecycle ownership", () => {
  it("terminates connected runtime sockets instead of hanging shutdown", async () => {
    const http = createServer();
    const port = await listen(http);
    const runtime: RuntimePort = {
      command: async () => ({ ok: true }),
      query: async () => ({ ok: true }),
    };
    const websocket = new RuntimeWebSocketServer(
      http,
      new CommandRouter(runtime),
    );
    const client = new WebSocket(`ws://127.0.0.1:${port}/runtime`);
    await new Promise<void>((resolve, reject) => {
      client.once("open", resolve);
      client.once("error", reject);
    });
    await websocket.close();
    expect(client.readyState).toBe(WebSocket.CLOSED);
    await close(http);
  });

  it("releases partial startup resources when the runtime port is unavailable", async () => {
    const blocker = createServer();
    const port = await listen(blocker);
    const root = await mkdtemp(join(tmpdir(), "hru-lifecycle-"));
    roots.push(root);
    await expect(
      startRuntimeStack(
        port,
        "blocked",
        join(root, "saves"),
        join(root, "observer"),
      ),
    ).rejects.toMatchObject({ code: "EADDRINUSE" });
    await close(blocker);
    const stack = await startRuntimeStack(
      port,
      "retry",
      join(root, "saves"),
      join(root, "observer"),
    );
    await stack.stop();
  });
});
