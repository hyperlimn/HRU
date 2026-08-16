# HRU — Hash-Relational Universe

HRU implements deterministic Universe Law v1. It does not contain spatial physics or render authoritative entities yet; Three.js remains a read-only observer showing clearly labeled development markers.

## Commands

```sh
npm run dev
npm run stop
npm run typecheck
npm test
npm run diagnostic
```

`npm run dev` starts the authoritative simulation worker, Node command/query runtime, WebSocket transport, MCP placeholder, persistent save store, and Vite UI. `npm run stop` verifies the HRU PID and instance token against the local health endpoint, requests authenticated graceful shutdown, and targets only that verified PID if the grace period expires.

On Windows CMD, Ctrl+C during an npm batch script may display `Terminate batch job (Y/N)?`. That prompt belongs to CMD/npm. HRU handles SIGINT by closing Vite, WebSocket/HTTP, and its worker and removing its PID record. `npm run stop` from another terminal is the prompt-free fallback.

## Ownership and boundaries

- `server/law` contains the framework-independent deterministic Law v1 modules.
- `server/runtime/simulation-worker.ts` owns the only evolving universe state and executes bounded tick batches.
- The main runtime owns commands, queries, saves, dimensions, status distribution, and lifecycle. It caches summaries, not a second evolving universe.
- `src/core` contains shared typed manifest, authoritative state, provenance, and summary contracts.
- `src/interface` carries the same command/query capabilities for browser and future machine/MCP adapters.
- `src/observer` remains read-only and never advances or mutates the universe.

Runtime controls and telemetry (`running`, multiplier, measured ticks/sec, active dimension, autosave status) are not deterministic universe state. Camera, render toggles, selected entities, and panel state are observer-only.

## Law v1 tick semantics

Genesis is stored at tick 0 with exactly `SHA256(UTF8("seed1"))` and `SHA256(UTF8("seed2"))`, zero contexts, and no bonds. Advancing from stored tick `t−1` processes Law tick `t`. Context changes, condensations, and injections produced during tick `t` participate beginning at tick `t+1`.

Injection begins at tick 10,000. Its first counter is 0; each scheduled injection consumes one counter even if its hash already exists and therefore cannot duplicate an entity.

All Law v1 parameters live in the typed manifest. `createdAt` is metadata only and is excluded from evolution and state digest.

## Canonical hash encoding

Hashes are 32 raw bytes internally and 64 lowercase hexadecimal characters at serialized boundaries. Invalid hash text is rejected. Integers and counts are unsigned 64-bit big-endian and reject negative, unsafe, and out-of-range input. Variable strings are `byteLength:uint64be | UTF-8 bytes`. Pairs and cluster members are lexicographically sorted by raw-equivalent lowercase hash.

Hash inputs have these exact layouts, with no implicit separators:

```text
genesis   = UTF8(seed)
phase     = entityHash[32] | tick:uint64be[8] | contextHash[32]
affinity  = phaseLow[32] | phaseHigh[32] | tick:uint64be[8]
            | contextLow[32] | contextHigh[32]
cluster   = sortedMemberHash[32] repeated without a count
injection = outsideSeedByteLength:uint64be[8] | outsideSeedUtf8[n]
            | tick:uint64be[8] | injectionCounter:uint64be[8]
```

`server/law/state-digest.ts` documents the complete canonical state layout. It begins with length-prefixed `HRU_STATE_V1`, encodes manifest law identity and fixed-order typed parameters, then canonically sorted entities/provenance, bonds, contexts, stability records, condensation records, injection counter, and deterministic module state. Numbers used for bond strengths and floating law parameters are IEEE-754 float64 big-endian. Metadata and runtime/observer controls are excluded.

## Persistence

Save format v2 writes validated JSON beneath `.hru-data/saves` through temporary-file plus atomic rename. Manual saves are permanent. Autosaves capture exact 100,000-tick worker boundaries and retain only the newest three. Full state is transferred from worker to main only for saves/resume.

Loading validates structure, canonical pairs/members, uniqueness, references, and manifest compatibility. Foundation-format/`foundation-0` saves fail explicitly rather than being reinterpreted as Law v1.

## Browser summaries

The browser receives compact summaries at most approximately ten times per second: tick, controls/throughput, entity and bond instruments, cluster instruments, condensation/injection counts, dimension, SHA-256 state digest, and autosave status. Full entity/bond state is not broadcast. Future detailed inspection APIs should be paginated.
