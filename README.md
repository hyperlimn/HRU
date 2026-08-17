# HRU — Hash-Relational Universe

HRU implements deterministic Universe Law v1 and a read-only Three.js Observation Module. Entity placement and visual persistence are observer projections only; HRU contains no spatial physics.

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
- `server/observation` creates immutable frames, deterministic relationship events, and bounded cursor buffers inside the worker boundary.

Runtime controls and telemetry (`running`, multiplier, measured ticks/sec, active dimension, autosave status) are not deterministic universe state. Camera, render toggles, selected entities, and panel state are observer-only.

### Deterministic VFX

`src/observer/vfx` contains renderer capability detection, an extensible effect registry, deterministic driver registries, curve/range/quantization mappings, weighted composition, and disposable postprocessing adapters. Bloom, selective bloom, and Particle Field run on the existing WebGL renderer. Depth of Field, Radial Blur, Linked Particles, and Vortex Field remain registered preparation sockets; Linked Particles reports its native WebGPU compute requirement.

VFX controls are Visual Lab schema values, so profile persistence and hashing, undo/redo, A/B comparison, and human/machine commands share one path. Disabling bloom disposes postprocessing resources and returns to the ordinary renderer. VFX data never enters authoritative state, universe saves, or the Law v1 digest. Future WebGPU effects attach through another capability adapter without removing the WebGL fallback.

Particle Field v1 is also functional on WebGL and uses one shared `THREE.Points` buffer. For source hash `S`, particle index `i`, and profile salt `v`, its identity is:

```text
SHA-256(lengthPrefixedUtf8("hru-particle-field-1") | rawHash(S) | uint64be(i) | uint64be(v))
```

Independent 16-bit fractions from that digest drive form, size, color, phase, and motion. Procedural movement is evaluated from the observation frame's universe tick; render delta and FPS are never inputs. Targets and particle indices are selected in canonical order when the global budget is exceeded. Particle configuration and buffers are observer-only, and disabling the effect disposes its geometry and shader material immediately. Depth of Field, Radial Blur, Linked Particles, and Vortex Field remain prepared or unavailable rather than simulated.

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

## Observation module

`observation/frame`, `observation/events`, and `observation/entity` use the same query layer as human UI and future machine/MCP clients. Frames are produced by the worker from a snapshot of its sole authoritative state and contain only immutable render/inspection records. Save listings similarly expose metadata and tick, never embedded authoritative snapshots.

Frames are requested at 4 Hz. Compact runtime summaries remain separate. Events are derived from consecutive deterministic states, canonically ordered, and given SHA-256 event identities. They are observer-only: not saved and not included in the state digest. The worker retains at most 4,096 sequenced events; cursor reads return at most 1,024, WebSocket pushes are capped to 256 per worker batch, and clients with excessive socket backpressure are skipped. Resume clears the event buffer and advances its generation.

Dimension-0 maps immutable hash bytes into a bounded `[-12, 12]³` volume. Render traits—color, emissive qualities, size, geometry variant, orientation, provenance styling, and context accent—are pure hash-derived functions. None are persisted or fed back into Law v1.

Three.js uses instanced entity meshes grouped by geometry variant. Current bonds use cylinder geometry rather than unsupported WebGL line widths; cyan represents positive bonds and magenta represents negative bonds, with stronger treatment at active thresholds. Clusters, contexts, ancestry, condensation accents, and Dimension-0 guides are separately channel-controlled. Recent relationship, injection, condensation, and cluster events persist visually for 2.5 wall-clock seconds in the observer-only phase-effects group.

Raycast selection maps instanced IDs back to entity hashes. The Entity panel shows provenance, creation tick, context, cluster, and current classified bonds. Selection, camera, channels, and animation clocks remain local observer state.

## Visual Lab v1

The Time instrument is mounted above the scrolling panel list, so its live tick, run/pause state, requested multiplier, and measured throughput remain visible. Auto Orbit is a small viewport control backed by the same observer-only `camera.autoRotate` Visual Lab value used by command and machine clients. Every expanded Visual Lab category and subgroup includes a reusable bottom Close action.

Relationship appearance is presented as one `Relationships` category with Positive / Active Bonds, Weak / Developing Bonds, Repulsion, Shared Relationship Geometry, and Temporal / Pulse Behavior subgroups. Entity geometric detail is observer-only and hash-derived: 32 bits of each immutable entity hash place it reproducibly between the configured minimum and maximum smoothness, while a variation-strength control blends toward the global detail baseline. Entity geometry is instanced by shape/detail combination and rebuilt automatically when this range changes. Detail is limited to integer levels 0–5 because polyhedron subdivision cost grows exponentially; replaced cached geometries are disposed.

Visual Lab is a schema-driven observer panel in the standard scrollable left sidebar. Its nested categories and optional subcategories come from metadata in `src/visual-lab/registry.ts`, so future visual modules can contribute controls without changing a central form. The registry is the single catalog for adjustable values, human labels, validation, slider guidance, update mode, and performance cost. Convenience slider ranges are separate from hard technical bounds: exact numeric entry may go beyond the slider whenever Three.js can represent it safely. The generated human controls and future machine clients use the same `visual-lab/*` command/query service; no control bypasses that service. The renderer consumes a complete normalized `VisualConfiguration` and never reads UI component state.

Visual data is stored atomically in `.hru-data/observer/visual-lab.json`, separately from `.hru-data/saves`. It contains the working configuration, named profiles, favorites, sidebar preferences, and A/B slots. It is observer-only: it is absent from universe snapshots, autosave rotation, Law v1 state serialization, and the state digest. Set `HRU_OBSERVER_DATA_DIR` to use an isolated observer-data directory during development or verification. A missing or invalid file recovers to built-ins; a clean first run selects `High Visibility`.

Profiles have canonical SHA-256 identities over their format/schema version, name, optional description, and all normalized values in registry order. Metadata timestamps are excluded. Built-ins (`HRU Default`, `High Visibility`, `Deep Field`, and `Diagnostic`) are immutable. Imported profiles are strictly validated and incompatible schemas are rejected. A/B changes preserve the camera because camera position is local observer state. Future per-client sessions attach above `VisualLabService`; v1 intentionally broadcasts one globally shared visual configuration. Pagination, observation deltas, LOD, and split-screen A/B remain extension points rather than partial implementations.

Future scaling attaches at three explicit seams: paginated `observation/entity`/collection queries, cursor-based delta frames alongside the current complete frame, and renderer-adapter level-of-detail or WebGPU implementations. The current complete frame is never silently truncated.

Vortex Field v1 is an observer-only procedural module using one shared `THREE.LineSegments` buffer. Its stable identity is `SHA-256(lengthPrefixedUtf8("hru-vortex-field-1") | rawSourceHash | uint64be(visualSalt))`; digest fractions determine axis variation, curvature, disorder, handedness, and pulse phase. Geometry is evaluated from universe ticks and canonical source ordering. Relationship-axis and cluster-center projections are supported. Vortex Field and Particle Field share only generic driver routing and renderer lifecycle contracts; neither mutates authoritative state or the other subsystem's geometry.

Radial Blur v1 is an observer-only, tick-driven postprocessing pass. Event identities use `SHA-256(lengthPrefixedUtf8("hru-radial-blur-1") | source identity | source tick | visual salt)`. When the WebGL path has one center, simultaneous events are combined by descending deterministic strength and event identity. The pass order is RenderPass → Radial Blur → Bloom → OutputPass; disabling it removes the pass and leaves ordinary observation rendering available.

Depth of Field v1 is camera-owned observer state under Visual Lab → Camera. It uses Three.js `BokehPass` and is inserted before Radial Blur: RenderPass → Depth of Field → Radial Blur → Bloom → OutputPass. Focus can be manual, selected entity, the selected entity's cluster, nearest rendered entity, or largest visible cluster; unavailable targets retain the last valid focus distance and otherwise fall back to manual distance. The compact viewport Camera menu is another control surface over the same Visual Lab values.

Global Palette uses stable string palette IDs for built-in and custom palettes. Legacy numeric selections are converted only by `server/visual-lab/migrations.ts` using the explicit mapping `0..4` to `hru-default`, `high-visibility`, `deep-field`, `monochrome`, and `aurora`; invalid legacy values report a warning and fall back to `hru-default`. New state and profiles persist string IDs.

All universe-render color sources pass through `src/visual-lab/palettes.ts` when Global Palette is enabled. Stable SHA-256 fractions are cached by source identity plus a named channel such as `entity/base`, `entity/glow`, `relationship/base`, or `event/accent`. Semantic roles select an ordered swatch subset; absent roles use the whole palette. Continuous mode interpolates between palette swatches, while discrete and semantic modes select exact swatches. When Global Palette is disabled, the resolver returns the original explicit color unchanged. Palette changes rebuild current materials, vertex colors, lights, fog, and grid resources without rebuilding entity geometry.
