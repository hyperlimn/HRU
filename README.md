# HRU — Hash-Relational Universe

HRU currently provides the modular foundation for a deterministic universe simulator. It intentionally contains no universe laws or physics.

## Run

```sh
npm run dev
```

This starts the authoritative Node runtime, simulation-worker placeholder, WebSocket transport, and Vite browser UI in one HRU-owned process. Open `http://localhost:5173`.

```sh
npm run stop
npm run typecheck
npm test
```

`npm run stop` reads the HRU-specific PID record, verifies its instance token and PID against the HRU health endpoint, and signals only that stack. It waits for graceful cleanup before using an exact verified-PID fallback; it never searches for or kills arbitrary Node processes.

On Windows CMD, pressing Ctrl+C while running an npm batch script may display `Terminate batch job (Y/N)?`. This prompt is produced by `cmd.exe`/npm outside HRU and cannot be suppressed reliably from the Node process. HRU handles the signal first, closes Vite, the WebSocket/HTTP server, and its worker, then removes its PID record. Answering `Y` after `HRU STOPPED` is safe. `npm run stop` remains available from another terminal if the shell interrupts before cleanup completes.

## Architecture

- `src/core` — framework-free universe state, manifest, and deterministic domain concepts.
- `src/runtime` — transport-neutral runtime port.
- `src/interface` — shared command/query protocol plus human and future machine adapters.
- `src/observer` — Three.js observation and named render channels. It does not advance simulation state.
- `src/modules` — small module contracts and the registry for instruments, saves, dimensions, and laboratory work.
- `server/runtime` — authoritative tick runtime, worker boundary, in-memory foundation save store, and system implementations.
- `server/commands` — the single command/query router used by transports.
- `server/websocket` — browser transport adapter.
- `server/mcp` — prepared MCP adapter socket; no MCP tools are exposed yet.
- `scripts` — lifecycle orchestration scoped to HRU.

Tick progression uses a fixed runtime timer independently of render FPS. Displayed throughput is measured over a short rolling window as ticks advanced divided by elapsed wall-clock seconds; it is not inferred from the requested multiplier. The worker exists as a real thread boundary but does not yet calculate laws. Three.js renders clearly labeled deterministic demo markers which are never placed in authoritative state.

Dimensions are projection lenses over the same canonical universe. Only `dimension-0` exists. Laboratory modules will receive structured-cloned snapshot forks, preventing experiments from mutating the canonical runtime.

The persistent save store writes validated JSON beneath `.hru-data/saves`. Manual saves are durable and permanent; autosaves occur every 100,000 ticks and retain only the newest three. Writes use a temporary file and atomic rename. Resume rejects malformed data and manifests with incompatible universe IDs, law versions, hash algorithms, genesis hashes, law parameters, or deterministic module sets. Observer camera, render channels, and other UI-only state never enter these snapshots.

The manifest's `createdAt` field is metadata only. `deterministicManifest()` explicitly removes it from the data eligible to determine simulation behavior.
