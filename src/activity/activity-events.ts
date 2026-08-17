import type { Command, CommandResult } from "../interface/protocol";

export type ActivityLevel = "info" | "warning" | "error";
export type ActivityOrigin =
  | "human-ui"
  | "machine"
  | "runtime"
  | "observer"
  | "system";
export type ActivityCategory =
  | "RUN"
  | "SPEED"
  | "ENTITY"
  | "CAMERA"
  | "VISUAL"
  | "PALETTE"
  | "VFX"
  | "SAVE"
  | "RUNTIME"
  | "PROFILE"
  | "RECIPE"
  | "RENDER"
  | "DIMENSION"
  | "LAB"
  | "MACHINE"
  | "SYSTEM";

export interface ActivityEvent {
  readonly sequence: number;
  readonly timestamp: string;
  readonly category: ActivityCategory;
  readonly level: ActivityLevel;
  readonly action: string;
  readonly message: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly origin: ActivityOrigin;
}

export type ActivityEventDraft = Omit<
  ActivityEvent,
  "sequence" | "timestamp"
> & { readonly timestamp?: string };

export class ActivityBuffer {
  private events: ActivityEvent[] = [];
  private sequence = 0;

  constructor(
    private retention = 1_000,
    private readonly now = () => new Date(),
  ) {
    this.setRetention(retention);
  }

  append(draft: ActivityEventDraft): ActivityEvent {
    const event: ActivityEvent = {
      ...draft,
      action: boundedText(draft.action, 100),
      message: boundedText(draft.message, 2_000),
      sequence: ++this.sequence,
      timestamp: draft.timestamp ?? this.now().toISOString(),
      ...(draft.data ? { data: sanitizeActivityData(draft.data) } : {}),
    };
    this.events = [...this.events, event].slice(-this.retention);
    return event;
  }

  ingest(event: ActivityEvent): ActivityEvent {
    return this.append({
      category: event.category,
      level: event.level,
      action: event.action,
      message: event.message,
      origin: event.origin,
      timestamp: event.timestamp,
      ...(event.data ? { data: event.data } : {}),
    });
  }

  clear(): void {
    this.events = [];
  }

  setRetention(retention: number): void {
    if (!Number.isInteger(retention) || retention < 1 || retention > 10_000)
      throw new Error("Activity retention must be an integer from 1 to 10,000");
    this.retention = retention;
    this.events = this.events.slice(-retention);
  }

  getRetention(): number {
    return this.retention;
  }
  snapshot(): readonly ActivityEvent[] {
    return this.events;
  }
}

export function formatActivityLine(event: ActivityEvent): string {
  const time =
    /^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})/.exec(event.timestamp)?.[1] ??
    event.timestamp;
  const level = event.level === "info" ? "" : `${event.level.toUpperCase()} `;
  return `[${time}] ${event.category.padEnd(9)} ${level}${event.message}`;
}

export function formatActivityCli(events: readonly ActivityEvent[]): string {
  return events.map(formatActivityLine).join("\n");
}

export function serializeActivityJson(
  events: readonly ActivityEvent[],
): string {
  return JSON.stringify(events, null, 2);
}

export function activityForCommand(
  command: Command,
  result: CommandResult,
  origin: ActivityOrigin,
): ActivityEventDraft {
  const base = commandActivity(command);
  if (!result.ok) {
    return {
      ...base,
      level: "error",
      message: `${base.action.toLowerCase()} failed: ${result.message ?? "Unknown command error"}`,
      origin,
      data: { command: command.type },
    };
  }
  return {
    ...base,
    level: "info",
    message: result.message ?? base.message,
    origin,
    data: { command: command.type, ...base.data },
  };
}

function commandActivity(
  command: Command,
): Pick<ActivityEventDraft, "category" | "action" | "message" | "data"> {
  switch (command.type) {
    case "time/set-running":
      return {
        category: "RUN",
        action: command.running ? "RESUME" : "PAUSE",
        message: `universe ${command.running ? "resumed" : "paused"}`,
      };
    case "time/set-multiplier":
      return {
        category: "SPEED",
        action: "SET",
        message: `multiplier → ${command.multiplier}×`,
        data: { multiplier: command.multiplier },
      };
    case "saves/save-current":
      return {
        category: "SAVE",
        action: "CREATE",
        message: command.label
          ? `snapshot “${command.label}” created`
          : "manual snapshot created",
      };
    case "saves/resume":
      return {
        category: "SAVE",
        action: "RESUME",
        message: `snapshot ${command.snapshotId} resumed`,
        data: { snapshotId: command.snapshotId },
      };
    case "dimensions/select":
      return {
        category: "DIMENSION",
        action: "SELECT",
        message: `active → ${command.dimensionId}`,
        data: { dimensionId: command.dimensionId },
      };
    case "visual-lab/value/set": {
      const category = visualCategory(command.id);
      return {
        category,
        action: "SET",
        message: `${command.id} → ${displayValue(command.value)}`,
        data: { parameter: command.id, value: command.value },
      };
    }
    case "visual-lab/values/patch":
      return {
        category: "VISUAL",
        action: "PATCH",
        message: `${Object.keys(command.values).length} visual settings updated`,
        data: { parameters: Object.keys(command.values) },
      };
    case "visual-lab/reset-parameter":
      return {
        category: visualCategory(command.id),
        action: "RESET",
        message: `${command.id} reset`,
        data: { parameter: command.id },
      };
    case "visual-lab/reset-group":
      return {
        category: "VISUAL",
        action: "RESET",
        message: `${command.group} reset`,
      };
    case "visual-lab/reset-all":
      return {
        category: "VISUAL",
        action: "RESET",
        message: "all observer visuals reset",
      };
    case "visual-lab/undo":
      return {
        category: "VISUAL",
        action: "UNDO",
        message: "visual change undone",
      };
    case "visual-lab/redo":
      return {
        category: "VISUAL",
        action: "REDO",
        message: "visual change redone",
      };
    case "visual-lab/profile/load":
      return {
        category: "PROFILE",
        action: "LOAD",
        message: `active → ${command.name}`,
      };
    case "visual-lab/profile/save":
      return {
        category: "PROFILE",
        action: "SAVE",
        message: `saved “${command.name}”`,
      };
    case "visual-lab/profile/duplicate":
      return {
        category: "PROFILE",
        action: "DUPLICATE",
        message: `duplicated as “${command.name}”`,
      };
    case "visual-lab/profile/rename":
      return {
        category: "PROFILE",
        action: "RENAME",
        message: `${command.source} → ${command.name}`,
      };
    case "visual-lab/profile/delete":
      return {
        category: "PROFILE",
        action: "DELETE",
        message: `deleted “${command.name}”`,
      };
    case "visual-lab/profile/import":
      return {
        category: "PROFILE",
        action: "IMPORT",
        message: "profile imported",
      };
    case "visual-lab/profile/export":
      return {
        category: "PROFILE",
        action: "EXPORT",
        message: `exported “${command.name}”`,
      };
    case "visual-lab/ab/store":
      return {
        category: "PROFILE",
        action: "STORE",
        message: `A/B slot ${command.slot} stored`,
      };
    case "visual-lab/ab/toggle":
      return {
        category: "PROFILE",
        action: "TOGGLE",
        message: "A/B comparison toggled",
      };
    case "visual-lab/favorite/toggle":
      return {
        category: "VISUAL",
        action: "FAVORITE",
        message: `${command.id} favorite toggled`,
      };
    case "visual-lab/preference/set":
      return {
        category: "VISUAL",
        action: "PREFERENCE",
        message: `${command.preference} → ${command.value}`,
      };
    case "visual-lab/recipe/apply":
      return {
        category: "RECIPE",
        action: "APPLY",
        message: `applied ${command.id}`,
      };
    case "visual-lab/palette/select":
      return {
        category: "PALETTE",
        action: "SELECT",
        message: `active → ${command.id}`,
      };
    case "visual-lab/palette/create":
      return {
        category: "PALETTE",
        action: "CREATE",
        message: `created “${command.palette.name}”`,
      };
    case "visual-lab/palette/update":
      return {
        category: "PALETTE",
        action: "UPDATE",
        message: `updated “${command.palette.name}”`,
      };
    case "visual-lab/palette/duplicate":
      return {
        category: "PALETTE",
        action: "DUPLICATE",
        message: `duplicated as “${command.name}”`,
      };
    case "visual-lab/palette/rename":
      return {
        category: "PALETTE",
        action: "RENAME",
        message: `renamed → “${command.name}”`,
      };
    case "visual-lab/palette/delete":
      return {
        category: "PALETTE",
        action: "DELETE",
        message: `deleted ${command.id}`,
      };
    case "visual-lab/palette/import":
      return {
        category: "PALETTE",
        action: "IMPORT",
        message: "palette imported",
      };
    case "visual-lab/palette/export":
      return {
        category: "PALETTE",
        action: "EXPORT",
        message: `exported ${command.id}`,
      };
  }
}

function visualCategory(id: string): ActivityCategory {
  if (id.startsWith("camera.")) return "CAMERA";
  if (id.startsWith("vfx.")) return "VFX";
  if (id.startsWith("palette.")) return "PALETTE";
  return "VISUAL";
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function boundedText(value: string, maximum: number): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 3)}...`;
}

function sanitizeActivityData(
  data: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const seen = new WeakSet<object>();
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (typeof value === "function" || typeof value === "symbol")
        return undefined;
      if (typeof value === "string" && value.length > 2_000)
        return `${value.slice(0, 2_000)}…`;
      if (value && typeof value === "object") {
        if (seen.has(value)) return "[circular]";
        seen.add(value);
      }
      if (Array.isArray(value) && value.length > 100)
        return [...value.slice(0, 100), "[truncated]"];
      return value;
    }),
  ) as Readonly<Record<string, unknown>>;
}
