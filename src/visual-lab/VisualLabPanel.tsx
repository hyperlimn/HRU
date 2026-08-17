import { useMemo, useState, type ChangeEvent } from "react";
import type { CommandResult } from "../interface/protocol";
import { Disclosure } from "../interface/human/components/Disclosure";
import { PALETTE_ROLES, type Palette } from "./palettes";
import {
  OPEN_VISUAL_CONTROL_EVENT,
  ParameterControl,
  groupParameters,
  revealVisualControl,
} from "./VisualControls";
import type {
  VisualLabCommand,
  VisualLabState,
  VisualParameterDefinition,
} from "./types";
import { useVisualLab } from "./visual-lab-context";
import { useActivity } from "../activity/activity-context";
import { VisualObjectPanel } from "./VisualObjectPanel";
import { SIDEBAR_OPEN_PANEL_EVENT } from "../interface/human/components/Panel";

export function VisualLabPanel() {
  const { record } = useActivity();
  const {
    state,
    schema,
    profiles,
    palettes,
    recipes,
    telemetry,
    error,
    clearError,
    execute,
    setValue,
  } = useVisualLab();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [profileJson, setProfileJson] = useState("");
  const searching = Boolean(search.trim());
  const visible = useMemo(() => {
    if (!state) return [];
    const needle = search.trim().toLowerCase();
    return schema.filter(
      (item) =>
        item.id !== "palette.active" &&
        item.id !== "palette.enabled" &&
        item.category !== "Camera" &&
        (!state.favoritesOnly || state.favorites.includes(item.id)) &&
        (state.showAdvanced || !item.advanced) &&
        (!needle ||
          `${item.label} ${item.id} ${item.category} ${item.subcategory ?? ""} ${item.description}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [schema, search, state]);
  const performanceItems = useMemo(
    () =>
      visible.filter((item) => item.category === "Performance / Observation"),
    [visible],
  );
  const categories = useMemo(
    () =>
      [
        ...new Set(
          visible
            .filter((item) => item.category !== "Performance / Observation")
            .map((item) => item.category),
        ),
      ]
        .map((name) => ({
          name,
          order: visible.find((item) => item.category === name)!.categoryOrder,
          items: visible.filter((item) => item.category === name),
        }))
        .sort((a, b) => a.order - b.order),
    [visible],
  );

  if (!state) return <small>Connecting to observer controls…</small>;

  const run = async (
    command: VisualLabCommand,
  ): Promise<CommandResult | undefined> => {
    try {
      const result = await execute(command);
      setMessage(result.message ?? "Applied");
      return result;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
      return undefined;
    }
  };
  const exportProfile = async () => {
    try {
      const result = await run({
        type: "visual-lab/profile/export",
        name: state.activeProfile,
      });
      if (typeof result?.data === "string") {
        setProfileJson(result.data);
        await navigator.clipboard.writeText(result.data);
      }
    } catch (cause) {
      record({
        category: "PROFILE",
        level: "error",
        action: "EXPORT",
        message: `export copy failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        origin: "human-ui",
      });
    }
  };
  const openControl = (id: string) => {
    void (async () => {
      try {
        const parameter = schema.find((item) => item.id === id);
        for (const command of visualControlRevealCommands(parameter, state))
          await execute(command);

        const panelId = id.startsWith("camera.") ? "camera" : "visual-lab";
        if (panelId === "visual-lab")
          setSearch(id.startsWith("palette.") ? "" : id);
        window.dispatchEvent(
          new CustomEvent(SIDEBAR_OPEN_PANEL_EVENT, { detail: { panelId } }),
        );
        window.dispatchEvent(
          new CustomEvent(OPEN_VISUAL_CONTROL_EVENT, { detail: { id } }),
        );
        window.setTimeout(() => revealVisualControl(id), 80);
      } catch {
        // Visual Lab context already exposes the command error beside the controls.
      }
    })();
  };

  const renderParameter = (parameter: VisualParameterDefinition) => (
    <ParameterControl
      key={parameter.id}
      parameter={parameter}
      value={state.values[parameter.id]!}
      favorite={state.favorites.includes(parameter.id)}
      showPath={searching}
      onValue={(value) => setValue(parameter.id, value, false)}
      onReset={() =>
        void run({ type: "visual-lab/reset-parameter", id: parameter.id })
      }
      onFavorite={() =>
        void run({ type: "visual-lab/favorite/toggle", id: parameter.id })
      }
    />
  );

  return (
    <div className="visual-sidebar">
      <VisualObjectPanel onOpenControl={openControl} />
      <div className="visual-profile-summary">
        <strong>
          {state.activeProfile}
          {state.dirty ? " · modified" : ""}
        </strong>
        <button
          onClick={() =>
            void navigator.clipboard.writeText(state.activeProfileHash)
          }
        >
          Copy hash
        </button>
        <output className="digest">{state.activeProfileHash}</output>
      </div>
      <input
        className="visual-search"
        aria-label="Search Visual Lab controls"
        placeholder="Search settings, effects, or IDs…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="visual-actions">
        <button
          disabled={!state.canUndo}
          onClick={() => void run({ type: "visual-lab/undo" })}
        >
          Undo
        </button>
        <button
          disabled={!state.canRedo}
          onClick={() => void run({ type: "visual-lab/redo" })}
        >
          Redo
        </button>
        <button onClick={() => void run({ type: "visual-lab/reset-all" })}>
          Reset all
        </button>
      </div>
      <div className="visual-filters">
        <label>
          <input
            type="checkbox"
            checked={state.favoritesOnly}
            onChange={(event) =>
              void run({
                type: "visual-lab/preference/set",
                preference: "favoritesOnly",
                value: event.target.checked,
              })
            }
          />
          Favorites only
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.showAdvanced}
            onChange={(event) =>
              void run({
                type: "visual-lab/preference/set",
                preference: "showAdvanced",
                value: event.target.checked,
              })
            }
          />
          Advanced
        </label>
      </div>
      {(error || message) && (
        <div
          className={error ? "visual-error" : "visual-status"}
          role={error ? "alert" : "status"}
        >
          <span>{error ?? message}</span>
          <button
            aria-label="Dismiss status"
            onClick={() => {
              clearError();
              setMessage("");
            }}
          >
            ×
          </button>
        </div>
      )}
      {state.paletteWarning && (
        <div className="visual-warning" role="status">
          {state.paletteWarning}
        </div>
      )}

      <PaletteLibrary
        activeId={String(state.values["palette.active"])}
        paletteEnabled={state.values["palette.enabled"] === true}
        palettes={palettes}
        run={run}
      />

      <div className="visual-category-list">
        {categories.map(({ name, items }) => (
          <Disclosure
            key={name}
            title={name}
            count={items.length}
            forceOpen={searching}
            level="category"
          >
            {groupParameters(items).map(
              ({ name: subcategory, items: subitems }) =>
                subcategory ? (
                  <Disclosure
                    key={subcategory}
                    title={subcategory}
                    count={subitems.length}
                    forceOpen={searching}
                  >
                    {subitems.map(renderParameter)}
                  </Disclosure>
                ) : (
                  subitems.map(renderParameter)
                ),
            )}
          </Disclosure>
        ))}
        {searching && categories.length === 0 && (
          <p className="visual-empty">No settings match “{search.trim()}”.</p>
        )}
      </div>

      <Disclosure title="Recipes" count={recipes.length} level="category">
        <div className="recipe-list">
          {recipes.map((recipe) => (
            <article key={recipe.id}>
              <div>
                <strong>{recipe.name}</strong>
                <p>{recipe.description}</p>
              </div>
              <button
                onClick={() =>
                  void run({ type: "visual-lab/recipe/apply", id: recipe.id })
                }
              >
                Apply
              </button>
            </article>
          ))}
        </div>
      </Disclosure>
      {(!searching || performanceItems.length > 0) && (
        <Disclosure
          title="Performance / Observation"
          count={performanceItems.length}
          forceOpen={searching}
          level="category"
        >
          {performanceItems.map(renderParameter)}
          <Disclosure title="Renderer telemetry" forceOpen={searching}>
            <dl>
              <dt>FPS</dt>
              <dd>{telemetry.fps.toFixed(0)}</dd>
              <dt>Draw calls</dt>
              <dd>{telemetry.drawCalls}</dd>
              <dt>Triangles</dt>
              <dd>{telemetry.triangles.toLocaleString()}</dd>
              <dt>Geometries</dt>
              <dd>{telemetry.geometries}</dd>
              <dt>Textures</dt>
              <dd>{telemetry.textures}</dd>
              <dt>Active VFX</dt>
              <dd>{telemetry.activeEffects}</dd>
            </dl>
          </Disclosure>
        </Disclosure>
      )}
      <Disclosure title="Profiles" count={profiles.length} level="category">
        <label className="field-label">
          Active profile
          <select
            value={state.activeProfile}
            onChange={(event) =>
              void run({
                type: "visual-lab/profile/load",
                name: event.target.value,
              })
            }
          >
            {profiles.map((profile) => (
              <option key={profile.name} value={profile.name}>
                {profile.name}
                {profile.builtIn ? " · built-in" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="visual-actions">
          <button
            onClick={() => {
              const name = prompt("Profile name");
              if (name) void run({ type: "visual-lab/profile/save", name });
            }}
          >
            Save
          </button>
          <button
            onClick={() => {
              const name = prompt("Duplicate as");
              if (name)
                void run({
                  type: "visual-lab/profile/duplicate",
                  source: state.activeProfile,
                  name,
                });
            }}
          >
            Duplicate
          </button>
          <button
            disabled={
              profiles.find((profile) => profile.name === state.activeProfile)
                ?.builtIn
            }
            onClick={() =>
              void run({
                type: "visual-lab/profile/delete",
                name: state.activeProfile,
              })
            }
          >
            Delete
          </button>
          <button onClick={() => void exportProfile()}>Export</button>
        </div>
        <textarea
          className="palette-json"
          value={profileJson}
          onChange={(event) => setProfileJson(event.target.value)}
          placeholder="Paste or export profile JSON"
          aria-label="Visual profile JSON"
        />
        <button
          disabled={!profileJson.trim()}
          onClick={async () => {
            const result = await run({
              type: "visual-lab/profile/import",
              json: profileJson,
            });
            if (result?.ok) setProfileJson("");
          }}
        >
          Import profile
        </button>
      </Disclosure>
      <small className="visual-count">
        {visible.length} of{" "}
        {schema.filter((item) => item.category !== "Camera").length} Visual Lab
        parameters shown · Camera controls are in Camera
      </small>
    </div>
  );
}

export function visualControlRevealCommands(
  parameter: VisualParameterDefinition | undefined,
  state: Pick<VisualLabState, "showAdvanced" | "favoritesOnly">,
): readonly VisualLabCommand[] {
  return [
    ...(parameter?.advanced && !state.showAdvanced
      ? [
          {
            type: "visual-lab/preference/set" as const,
            preference: "showAdvanced" as const,
            value: true,
          },
        ]
      : []),
    ...(state.favoritesOnly
      ? [
          {
            type: "visual-lab/preference/set" as const,
            preference: "favoritesOnly" as const,
            value: false,
          },
        ]
      : []),
  ];
}

function PaletteLibrary({
  activeId,
  paletteEnabled,
  palettes,
  run,
}: {
  readonly activeId: string;
  readonly paletteEnabled: boolean;
  readonly palettes: readonly (Palette & { readonly hash: string })[];
  readonly run: (
    command: VisualLabCommand,
  ) => Promise<CommandResult | undefined>;
}) {
  const { record } = useActivity();
  const active =
    palettes.find((palette) => palette.id === activeId) ?? palettes[0];
  const [json, setJson] = useState("");
  const [fileError, setFileError] = useState("");
  if (!active) return null;
  const update = (patch: Partial<Palette>) =>
    void run({
      type: "visual-lab/palette/update",
      palette: { ...active, ...patch, builtIn: false },
    });
  const exportPalette = async () => {
    try {
      const result = await run({
        type: "visual-lab/palette/export",
        id: active.id,
      });
      if (typeof result?.data === "string") {
        setJson(result.data);
        await navigator.clipboard.writeText(result.data);
      }
    } catch (cause) {
      record({
        category: "PALETTE",
        level: "error",
        action: "EXPORT",
        message: `export copy failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        origin: "human-ui",
      });
    }
  };
  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setJson(await file.text());
      setFileError("");
    } catch (cause) {
      const message = `Could not read palette file: ${cause instanceof Error ? cause.message : String(cause)}`;
      setFileError(message);
      record({
        category: "PALETTE",
        level: "error",
        action: "FILE",
        message,
        origin: "human-ui",
      });
    }
    event.target.value = "";
  };
  return (
    <Disclosure
      title="Color Palette"
      count={palettes.length}
      level="category"
      defaultOpen
    >
      <Disclosure title="Palette Library" defaultOpen>
        <label
          className="field-label"
          data-visual-parameter-id="palette.enabled"
        >
          Color mode
          <select
            value={paletteEnabled ? "Palette" : "Legacy Colors"}
            onChange={(event) =>
              void run({
                type: "visual-lab/value/set",
                id: "palette.enabled",
                value: event.target.value === "Palette",
              })
            }
          >
            <option>Legacy Colors</option>
            <option>Palette</option>
          </select>
        </label>
        <label
          className="field-label"
          data-visual-parameter-id="palette.active"
        >
          Active palette
          <select
            value={active.id}
            onChange={(event) =>
              void run({
                type: "visual-lab/palette/select",
                id: event.target.value,
              })
            }
          >
            {palettes.map((palette) => (
              <option key={palette.id} value={palette.id}>
                {palette.name}
                {palette.builtIn ? " · built-in" : ""}
              </option>
            ))}
          </select>
        </label>
        <div
          className="palette-preview"
          aria-label={`${active.name} color swatches`}
        >
          {active.colors.map((color, index) => (
            <i
              key={`${color}-${index}`}
              style={{ background: color }}
              title={`${index}: ${color}`}
            />
          ))}
        </div>
        <small className="palette-identity">
          {active.id} · {active.hash}
        </small>
        <div className="visual-actions">
          <button
            onClick={() => {
              const name = prompt("New palette name");
              if (name)
                void run({
                  type: "visual-lab/palette/create",
                  palette: {
                    id: `custom-${Date.now().toString(36)}`,
                    name,
                    colors: ["#52d8ff", "#ff4f9b"],
                    builtIn: false,
                  },
                });
            }}
          >
            Create
          </button>
          <button
            onClick={() => {
              const name = prompt("Duplicate palette as");
              if (name)
                void run({
                  type: "visual-lab/palette/duplicate",
                  source: active.id,
                  name,
                });
            }}
          >
            Duplicate
          </button>
          <button
            disabled={active.builtIn}
            onClick={() => {
              const name = prompt("Rename palette", active.name);
              if (name)
                void run({
                  type: "visual-lab/palette/rename",
                  id: active.id,
                  name,
                });
            }}
          >
            Rename
          </button>
          <button
            disabled={active.builtIn}
            onClick={() =>
              void run({ type: "visual-lab/palette/delete", id: active.id })
            }
          >
            Delete
          </button>
          <button onClick={() => void exportPalette()}>Export</button>
        </div>
        <label className="palette-file">
          Load JSON file
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => void readFile(event)}
          />
        </label>
        <textarea
          className="palette-json"
          value={json}
          onChange={(event) => setJson(event.target.value)}
          placeholder="Paste or load exported palette JSON"
          aria-label="Palette import JSON"
        />
        {fileError && (
          <div className="visual-error" role="alert">
            <span>{fileError}</span>
          </div>
        )}
        <button
          disabled={!json.trim()}
          onClick={async () => {
            const result = await run({
              type: "visual-lab/palette/import",
              json,
            });
            if (result?.ok) setJson("");
          }}
        >
          Import and select
        </button>
      </Disclosure>
      <Disclosure title="Palette Editor">
        {active.colors.map((color, index) => (
          <div className="palette-swatch-editor" key={index}>
            <input
              type="color"
              value={color}
              disabled={active.builtIn}
              aria-label={`Swatch ${index + 1}`}
              onChange={(event) =>
                update({
                  colors: active.colors.map((entry, position) =>
                    position === index ? event.target.value : entry,
                  ),
                })
              }
            />
            <code>{color}</code>
            <button
              className="icon-button"
              aria-label={`Move swatch ${index + 1} up`}
              disabled={active.builtIn || index === 0}
              onClick={() =>
                update({ colors: move(active.colors, index, index - 1) })
              }
            >
              ↑
            </button>
            <button
              className="icon-button"
              aria-label={`Move swatch ${index + 1} down`}
              disabled={active.builtIn || index === active.colors.length - 1}
              onClick={() =>
                update({ colors: move(active.colors, index, index + 1) })
              }
            >
              ↓
            </button>
            <button
              className="icon-button"
              aria-label={`Remove swatch ${index + 1}`}
              disabled={active.builtIn || active.colors.length <= 2}
              onClick={() =>
                update({
                  colors: active.colors.filter(
                    (_, position) => position !== index,
                  ),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          disabled={active.builtIn || active.colors.length >= 32}
          onClick={() => update({ colors: [...active.colors, "#ffffff"] })}
        >
          Add color
        </button>
        <div className="palette-role-list">
          {PALETTE_ROLES.map((role) => (
            <label key={role}>
              <span>{role}</span>
              <input
                disabled={active.builtIn}
                inputMode="numeric"
                value={(active.roles?.[role] ?? []).join(",")}
                aria-label={`${role} swatch indexes`}
                onChange={(event) => {
                  const indexes = event.target.value
                    .split(",")
                    .map((entry) => Number(entry.trim()))
                    .filter(
                      (entry) =>
                        Number.isInteger(entry) &&
                        entry >= 0 &&
                        entry < active.colors.length,
                    );
                  update({ roles: { ...active.roles, [role]: indexes } });
                }}
              />
            </label>
          ))}
        </div>
      </Disclosure>
    </Disclosure>
  );
}

function move<T>(values: readonly T[], from: number, to: number): T[] {
  const next = [...values];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}
