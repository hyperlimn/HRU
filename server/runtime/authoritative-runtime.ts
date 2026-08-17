import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import type { RuntimeSummary, UniverseSnapshot } from "../../src/core/state";
import type { UniverseManifest } from "../../src/core/universe-manifest";
import type {
  Command,
  CommandResult,
  Query,
  QueryResult,
} from "../../src/interface/protocol";
import type { RuntimePort } from "../../src/runtime/runtime-port";
import { DIMENSION_ZERO } from "../../src/shared/ids";
import { ModuleRegistry } from "../../src/modules/module-registry";
import { DimensionRegistry } from "./dimension-registry";
import { ExperimentRegistry } from "./laboratory";
import { PersistentSaveStore } from "./persistent-save-store";
import type { SimulationWorkerHost } from "./simulation-worker-host";
import type { VisualLabService } from "../visual-lab/service";
import {
  ActivityBuffer,
  activityForCommand,
  type ActivityEventDraft,
  type ActivityOrigin,
} from "../../src/activity/activity-events";
import { resolveEffectiveVisualObject } from "../../src/observer/visual-object";
import type { Palette } from "../../src/visual-lab/palettes";

export class AuthoritativeRuntime extends EventEmitter implements RuntimePort {
  readonly modules = new ModuleRegistry();
  readonly saves: PersistentSaveStore;
  readonly dimensions = new DimensionRegistry();
  readonly laboratory = new ExperimentRegistry();
  private summary: RuntimeSummary;
  private activeDimension = DIMENSION_ZERO;
  private autosaveStatus: RuntimeSummary["autosaveStatus"] = "idle";
  private lastAutosaveTick?: number;
  private readonly activity = new ActivityBuffer(1_000);

  constructor(
    private readonly worker: SimulationWorkerHost,
    initialSummary: RuntimeSummary,
    manifest: UniverseManifest,
    saveDirectory?: string,
    readonly visualLab?: VisualLabService,
  ) {
    super();
    this.summary = initialSummary;
    this.saves = new PersistentSaveStore(
      saveDirectory ?? resolve(".hru-data", "saves"),
      manifest,
    );
    for (const module of [
      {
        id: "dimensions",
        label: "Dimensions",
        version: "1.0.0",
        deterministic: true,
      },
      {
        id: "saves",
        label: "Save System",
        version: "2.0.0",
        deterministic: false,
      },
      {
        id: "laboratory",
        label: "Laboratory",
        version: "0.1.0",
        deterministic: false,
      },
      {
        id: "instruments",
        label: "Instruments",
        version: "1.0.0",
        deterministic: true,
      },
      {
        id: "hru-law-1",
        label: "HRU Universe Law v1",
        version: "1.0.0",
        deterministic: true,
      },
    ])
      this.modules.register(module);
    worker.on("summary", (summary: RuntimeSummary) => {
      this.summary = this.decorate(summary);
      this.emit("summary", this.summary);
    });
    worker.on(
      "autosave-boundary",
      (state: UniverseSnapshot) => void this.persistAutosave(state),
    );
    worker.on("observation-events", (events, generation) =>
      this.emit("observation-events", events, generation),
    );
    worker.on("error", (error) => {
      console.error("SIM WORKER   ERROR", error);
      this.publishActivity({
        category: "SYSTEM",
        level: "error",
        action: "WORKER",
        message: `simulation worker error: ${error instanceof Error ? error.message : String(error)}`,
        origin: "system",
      });
    });
    visualLab?.on("change", (state) => this.emit("visual-state", state));
  }
  start(): void {
    this.emit("summary", this.currentSummary());
  }
  stop(): void {
    this.removeAllListeners();
  }
  currentSummary(): RuntimeSummary {
    return this.decorate(this.summary);
  }
  snapshot(): Promise<UniverseSnapshot> {
    return this.worker.getState();
  }

  async command(
    command: Command,
    origin: ActivityOrigin = "system",
  ): Promise<CommandResult> {
    let result: CommandResult;
    try {
      result = await this.executeCommand(command);
    } catch (error) {
      result = {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    this.publishActivity(activityForCommand(command, result, origin));
    return result;
  }

  private async executeCommand(command: Command): Promise<CommandResult> {
    if (command.type.startsWith("visual-lab/"))
      return this.requireVisualLab().execute(
        command as import("../../src/visual-lab/types").VisualLabCommand,
      );
    switch (command.type) {
      case "time/set-running":
        this.summary = this.decorate(
          await this.worker.setRunning(command.running),
        );
        break;
      case "time/set-multiplier":
        this.summary = this.decorate(
          await this.worker.setMultiplier(command.multiplier),
        );
        break;
      case "saves/save-current": {
        const state = await this.worker.getState();
        const saved = await this.saves.saveManual(state, command.label);
        return {
          ok: true,
          data: {
            id: saved.id,
            kind: saved.kind,
            label: saved.label,
            tick: saved.state.tick,
            savedAt: saved.savedAt,
          },
          message: `Saved tick ${saved.state.tick}`,
        };
      }
      case "saves/resume": {
        const state = await this.saves.load(command.snapshotId);
        if (!state) return { ok: false, message: "Snapshot not found" };
        this.summary = this.decorate(await this.worker.replaceState(state));
        this.emit("summary", this.summary);
        return {
          ok: true,
          data: this.summary,
          message: `Resumed tick ${state.tick}`,
        };
      }
      case "dimensions/select": {
        const state = await this.worker.getState();
        this.dimensions.project(command.dimensionId, state);
        this.activeDimension = command.dimensionId;
        this.summary = this.decorate(this.summary);
        break;
      }
    }
    this.emit("summary", this.summary);
    return { ok: true, data: this.summary };
  }
  async query(query: Query): Promise<QueryResult> {
    if (query.type.startsWith("visual-lab/"))
      return this.requireVisualLab().query(
        query as import("../../src/visual-lab/types").VisualLabQuery,
      );
    if (
      query.type === "visual-object/inspect" ||
      query.type === "visual-object/effective-state" ||
      query.type === "visual-object/why"
    ) {
      const visualLab = this.requireVisualLab(),
        [frame, eventBatch] = await Promise.all([
          this.worker.getObservationFrame(),
          this.worker.getObservationEvents(undefined, 512),
        ]),
        paletteResult = visualLab.query({ type: "visual-lab/palettes/list" }),
        palettes = (paletteResult.data as readonly Palette[] | undefined) ?? [];
      const effective = resolveEffectiveVisualObject(
        frame,
        query.selection,
        visualLab.state().values,
        { palettes, events: eventBatch.events.map(({ event }) => event) },
      );
      if (!effective)
        return {
          ok: false,
          message: `Visual object not found: ${query.selection.type} ${query.selection.sourceIdentity}`,
        };
      if (query.type === "visual-object/why")
        return { ok: true, data: effective.why };
      return { ok: true, data: effective };
    }
    switch (query.type) {
      case "universe/state":
        return { ok: true, data: this.currentSummary() };
      case "observation/frame":
        return { ok: true, data: await this.worker.getObservationFrame() };
      case "observation/events":
        return {
          ok: true,
          data: await this.worker.getObservationEvents(
            query.cursor,
            query.limit,
          ),
        };
      case "observation/entity":
        return {
          ok: true,
          data: await this.worker.getObservedEntity(query.hash),
        };
      case "saves/list":
        return {
          ok: true,
          data: (await this.saves.list()).map((save) => ({
            id: save.id,
            kind: save.kind,
            label: save.label,
            tick: save.state.tick,
            savedAt: save.savedAt,
          })),
        };
      case "dimensions/list":
        return {
          ok: true,
          data: this.dimensions.list().map(({ id, label }) => ({ id, label })),
        };
      case "laboratory/list":
        return {
          ok: true,
          data: this.laboratory.list().map(({ id, label }) => ({ id, label })),
        };
      case "modules/list":
        return { ok: true, data: this.modules.list() };
    }
    return { ok: false, message: "Unsupported query" };
  }
  private decorate(summary: RuntimeSummary): RuntimeSummary {
    return {
      ...summary,
      activeDimension: this.activeDimension,
      autosaveStatus: this.autosaveStatus,
      ...(this.lastAutosaveTick === undefined
        ? {}
        : { lastAutosaveTick: this.lastAutosaveTick }),
    };
  }
  private publishActivity(draft: ActivityEventDraft): void {
    this.emit("activity", this.activity.append(draft));
  }
  private requireVisualLab(): VisualLabService {
    if (!this.visualLab) throw new Error("Visual Lab is unavailable");
    return this.visualLab;
  }
  private async persistAutosave(state: UniverseSnapshot): Promise<void> {
    this.autosaveStatus = "saving";
    this.emit("summary", this.currentSummary());
    try {
      await this.saves.saveAutosave(state);
      this.lastAutosaveTick = state.tick;
      this.autosaveStatus = "saved";
      this.publishActivity({
        category: "SAVE",
        level: "info",
        action: "AUTOSAVE",
        message: `automatic snapshot created at tick ${state.tick.toLocaleString()}`,
        origin: "runtime",
        data: { tick: state.tick },
      });
    } catch (error) {
      this.autosaveStatus = "error";
      console.error("SAVE STORE   AUTOSAVE FAILED", error);
      this.publishActivity({
        category: "SAVE",
        level: "error",
        action: "AUTOSAVE",
        message: `autosave failed: ${error instanceof Error ? error.message : String(error)}`,
        origin: "runtime",
      });
    }
    this.summary = this.decorate(this.summary);
    this.emit("summary", this.summary);
  }
}
