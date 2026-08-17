# HRU — Hash-Relational Universe

HRU is a deterministic relational universe governed by Universe Law v1, with a read-only Three.js observer. Positions, colors, camera state, palettes, VFX, selection, and UI state are projections: there is no spatial physics and observer state never feeds back into the universe.

## Run and verify

```sh
npm install
npm run dev
npm run stop
npm run typecheck
npm test
npm run build
npm run diagnostic
```

`npm run dev` owns one local stack: the simulation worker, runtime command/query service, save store, WebSocket server at `ws://localhost:8787/runtime`, and Vite UI at `http://localhost:5173`. Startup uses strict ports and fails clearly when either is unavailable. `npm run stop` validates the PID and random instance token against the runtime health endpoint before requesting shutdown; it never scans for or kills unrelated Node processes.

## Architecture and ownership

- `server/law` is the framework-independent implementation of Universe Law v1.
- `server/runtime/simulation-worker.ts` owns the only evolving authoritative state and advances bounded tick batches.
- `server/runtime` owns orchestration, dimensions, laboratory sockets, saves, summaries, and observer projections.
- `server/commands` and `server/websocket` expose the shared typed command/query protocol.
- `src/core` and `src/shared` contain authoritative data contracts and stable identifiers.
- `src/modules` contains module-owned extension contracts for dimensions, instruments, saves, and experiments.
- `src/observer` contains deterministic read-only projections, selection, Three.js rendering, and VFX.
- `src/visual-lab` owns observer configuration, palettes, visual-feature coverage, and effective visual state.
- `src/interface` contains the registered human panels and the browser RuntimePort client.
- `src/activity` contains bounded, structured observer/runtime activity events.

Runtime controls and telemetry are not universe identity. Observer configuration is persisted separately, and no observer module can advance or replace canonical state.

## Universe Law v1

Genesis is tick 0 with exactly `SHA256(UTF8("seed1"))` and `SHA256(UTF8("seed2"))`, zero contexts, and no bonds. Advancing from stored tick `t−1` evaluates Law tick `t`; newly resolved contexts, condensations, and injections participate from tick `t+1`.

Law v1 uses canonical lowercase 256-bit hashes, canonical pair/member ordering, unsigned 64-bit big-endian integer encoding, big-endian float64 encoding, and length-prefixed UTF-8 where strings enter hash inputs. The state digest includes the manifest’s deterministic identity, entities and provenance, bonds, contexts, cluster stability, condensations, injection counter, and deterministic module state. It excludes manifest creation metadata, runtime telemetry, saves, observer state, palettes, camera state, and activity.

The required tick-100,000 digest is:

```text
f478f37ba9871378b9fec678b13155267b77bc1565fe9c3cb01246e455233a3c
```

Production Law and observer sources are guarded against `Math.random()`. Procedural visuals use stable hashes and universe ticks; frame rate and wall-clock time do not affect universe evolution or tick-derived VFX traits.

## Runtime, observation, and dimensions

The worker publishes compact summaries at most about ten times per second and retains a bounded 4,096-event observation buffer. Full observation frames and entity details are requested through `observation/*` queries. Resume replaces worker state, pauses advancement, clears observer events, and starts a new cursor generation.

Dimension IDs are first-class command/query values. Dimension 0 is the current registered projection and maps immutable hash bytes into `[-12, 12]³`; it is a lens on the canonical universe, not a second universe.

The Laboratory registry is intentionally empty. Its runner gives future experiments a structured clone of a snapshot, so an experiment cannot mutate canonical state by reference. The UI reports the actual registered experiment count and does not claim experiments exist.

## Saves

Save format v2 is strictly validated and written through a temporary file plus atomic rename under `.hru-data/saves`. Autosaves capture exact 100,000-tick boundaries and retain the newest three. Manual saves are permanent. Loading validates manifest compatibility, unique entities and bonds, canonical pairs/member lists, complete context coverage, and references. Missing saves return safely; malformed or incompatible saves fail with a specific error.

Observer Visual Lab state lives separately at `.hru-data/observer/visual-lab.json`. Missing state starts from `High Visibility`; corrupt or incompatible state recovers to built-ins and exposes a warning. `HRU_DATA_DIR` and `HRU_OBSERVER_DATA_DIR` can isolate verification data.

## Human interface

The compact sidebar is registry-driven and ordered as Time, Universe, Dimension, Observer, Entity, Camera, Visual Lab, Saves, Laboratory, Machine / MCP, System, and Activity Log. Time remains mounted above the scrolling panels. The Entity panel presents source facts only; render causality belongs to Visual Object.

Camera controls and the viewport camera popup use the same Visual Lab values. Visual Object “Open” links expand the owning sidebar panel and subgroup, scroll to the canonical control, and briefly highlight it. No duplicated settings state is created.

## Visual Lab and Visual Object

Visual Lab is the advanced schema-driven laboratory. The typed registry is the single catalog for IDs, labels, hierarchy, types, hard bounds, slider guidance, update requirements, and cost. The service serializes commands, validates complete configurations, persists atomically, and supplies reset, bounded undo/redo, favorites, search, profiles, A/B state, recipes, and palette import/export.

The visual-feature registry maps every parameter to a renderer/runtime consumer or an explicit `prepared`/`diagnostic` status. Architectural tests guard all three directions: registered parameter to consumer, consumer literal to registered parameter, and visible attribute to a deterministic or controlled derivation path. Prepared controls are labeled as such in the UI rather than silently acting like functional controls.

Visual Object is the easy front door. Raycasting preserves stable source identity separately from transient Three.js identity for entities, positive/weak/repulsive relationships, clusters, contexts, condensed entities, events, Particle Field sources, and Vortex Field sources. The panel shows only Appearance, Effects, Why, Controls, and Copy. Effective state is resolved from observation facts, configuration, palette inputs, measured screen contribution, and module diagnostics—not from raw UI component state.

Effect status uses the small vocabulary `ACTIVE`, `OFF`, `BLOCKED`, `NO TARGET`, `UNSUPPORTED`, and `INVISIBLE`. Diagnostics include exact target matching, renderer/postprocessing support, source counts/rank, particle and vortex budgets, DOF selection fallback, radial event age, and measured projected size for Selective Bloom.

## Palettes

Color Mode is either Legacy Colors or Palette. Selecting or importing a palette immediately enables Palette mode. Palette mode routes background, fog, grid, lights, entities, glow, positive/weak/repulsive relationships, clusters, contexts, condensation, ancestry, events, selection, particles, and vortices through the shared resolver. Legacy mode returns each renderer’s original color unchanged.

Palettes use stable string IDs, semantic roles, and deterministic source/channel fractions. Built-ins are immutable; custom palette CRUD, import conflict renaming, export, profile restoration, and missing-palette fallback share the Visual Lab service. Palette libraries are explicit renderer/VFX inputs—there is no mutable palette singleton or unbounded color-fraction cache. Active palette changes replace current material/vertex/environment colors without reload or entity-geometry rebuild.

## VFX and renderer lifecycle

WebGL implementations are functional for Bloom, Selective Bloom, Radial Blur, Depth of Field, Particle Field, and Vortex Field. Linked Particles is explicitly prepared/unavailable because its declared implementation requires native compute. Capability reporting never presents it as active.

The stable postprocessing order is:

```text
Render → Depth of Field → Radial Blur → Bloom/Selective Bloom → Output
```

Only enabled passes are present. Topology or quality changes dispose and rebuild the composer; disabling all postprocessing returns to direct rendering. Particle Field owns one `THREE.Points` resource and Vortex Field owns one `THREE.LineSegments` resource. Their deterministic identities, routing, source ordering, universe-tick motion, resource budgets, telemetry, and disposal stay observer-only. Repeated setting, selection, and enable/disable cycles are covered by lifecycle tests.

Entities are instanced by hash-derived shape/detail group. Relationships use cylinders because WebGL line width is not portable. Renderer groups own channels for entities, relationships, repulsion, clusters, contexts, ancestry, condensed entities, event/VFX phases, and dimension guides. Geometry caches and all replaced materials, geometry, passes, controls, and renderer resources are explicitly disposed.

Selective Bloom is screen-space. A valid target and positive material intensity can still be visually negligible when its measured projected diameter is subpixel or its pixels do not clear the luminance threshold. Visual Object reports the measured camera distance, projected diameter, effective intensity, postprocessing state, and threshold instead of guessing.

## Activity Log

Activity events are structured, origin-tagged, payload-bounded, and retained in a fixed-size buffer. The log records human and machine commands, saves, dimensions, palette/profile/recipe actions, visual selection/copy, renderer channel actions, startup/runtime errors, and meaningful no-target warnings. It does not ingest render frames, summary ticks, or per-frame visual resolution. The panel supports pause-scroll, retention, clear, copy text, and copy JSON; clearing it never affects universe or observer state.

## Human and machine interfaces

The browser and machine adapters use the same `RuntimePort` commands and queries. Machine-facing queries include universe and observation state, saves, dimensions, laboratory/modules, Visual Lab schema/state/profiles/recipes/palettes/coverage/diagnostics, and:

```text
visual-object/inspect
visual-object/effective-state
visual-object/why
```

These visual-object queries return the same causal structures used by the human panel. The `McpSocket` currently marks machine-origin RuntimePort calls, but no MCP transport/server is exposed; startup and the Machine / MCP panel state this explicitly. It is an adapter seam, not a claim of MCP readiness.

## Testing

The suite covers Law phases and the fixed digest, canonical encoding, deterministic injection/condensation, save validation and rotation, worker batching/rates/events, observer immutability, panel registration, Visual Lab validation/migrations/persistence/coverage, palettes, effective visual state, VFX mappings and budgets, renderer resource replacement, runtime activity, and lifecycle cleanup. Tests require only Node, npm, and installed project dependencies; they do not shell out to tools such as `rg`.

Current intentionally prepared controls are reported by `visual-lab/coverage`. The only prepared VFX module is Linked Particles; several advanced DOF, Radial Blur, Particle Field, and Vortex Field parameters are retained as visibly prepared schema values for compatible profile evolution and are not described as rendered behavior.
