import { useEffect, useState } from "react";
import type { VisualParameterDefinition, VisualValue } from "./types";
import { visualLabCoverage } from "./visual-features";

const coverageById = new Map(
  visualLabCoverage().map((item) => [item.parameterId, item]),
);
export const OPEN_VISUAL_CONTROL_EVENT = "hru:open-visual-control";

export function revealVisualControl(id: string): void {
  const element = document.querySelector<HTMLElement>(
    `[data-visual-parameter-id="${id}"]`,
  );
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
  element?.classList.add("visual-control-highlight");
  window.setTimeout(
    () => element?.classList.remove("visual-control-highlight"),
    1_400,
  );
}

export function ParameterControl({
  parameter,
  value,
  favorite,
  onValue,
  onReset,
  onFavorite,
  showPath = false,
}: {
  readonly parameter: VisualParameterDefinition;
  readonly value: VisualValue;
  readonly favorite: boolean;
  readonly onValue: (value: VisualValue) => void;
  readonly onReset: () => void;
  readonly onFavorite: () => void;
  readonly showPath?: boolean;
}) {
  return (
    <div className="visual-control" data-visual-parameter-id={parameter.id}>
      <div className="visual-control-heading">
        <button
          className={favorite ? "favorite active" : "favorite"}
          onClick={onFavorite}
          aria-label={`${favorite ? "Remove" : "Add"} ${parameter.label} ${favorite ? "from" : "to"} favorites`}
        >
          ★
        </button>
        <label>{parameter.label}</label>
        <button
          className="icon-button"
          onClick={onReset}
          aria-label={`Reset ${parameter.label}`}
        >
          ↺
        </button>
      </div>
      {showPath && (
        <small className="visual-path">
          {parameter.category}
          {parameter.subcategory ? ` › ${parameter.subcategory}` : ""} ·{" "}
          {parameter.id}
        </small>
      )}
      <p title={parameter.id}>{parameter.description}</p>
      {coverageById.get(parameter.id)?.status === "prepared" && (
        <small className="visual-prepared">
          Prepared / unimplemented — this value has no current renderer
          consumer.
        </small>
      )}
      <div className={`visual-input visual-input-${parameter.type}`}>
        {renderInput()}
      </div>
    </div>
  );

  function renderInput() {
    if (parameter.type === "boolean")
      return (
        <input
          type="checkbox"
          checked={value as boolean}
          onChange={(event) => onValue(event.target.checked)}
          aria-label={parameter.label}
        />
      );
    if (parameter.type === "color")
      return (
        <>
          <input
            type="color"
            value={value as string}
            onChange={(event) => onValue(event.target.value)}
            aria-label={`${parameter.label} color`}
          />
          <input
            value={value as string}
            onChange={(event) => onValue(event.target.value)}
            aria-label={`${parameter.label} hexadecimal value`}
          />
        </>
      );
    if (parameter.type === "select")
      return (
        <select
          value={value as string}
          onChange={(event) => onValue(event.target.value)}
          aria-label={parameter.label}
        >
          {parameter.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    if (parameter.type === "vector3")
      return (
        <>
          {(value as readonly number[]).map((part, index) => (
            <NumberEntry
              key={index}
              label={`${parameter.label} ${["X", "Y", "Z"][index]}`}
              value={part}
              step={parameter.step}
              onCommit={(next) => {
                const vector = [...(value as readonly number[])] as [
                  number,
                  number,
                  number,
                ];
                vector[index] = next;
                onValue(vector);
              }}
            />
          ))}
        </>
      );
    return (
      <>
        <input
          type="range"
          value={Math.max(
            parameter.sliderMin ?? -Infinity,
            Math.min(parameter.sliderMax ?? Infinity, value as number),
          )}
          min={parameter.sliderMin}
          max={parameter.sliderMax}
          step={parameter.step}
          onChange={(event) => onValue(Number(event.target.value))}
          aria-label={`${parameter.label} slider`}
        />
        <NumberEntry
          label={parameter.label}
          value={value as number}
          step={parameter.step}
          onCommit={onValue}
        />
      </>
    );
  }
}

function NumberEntry({
  label,
  value,
  step,
  onCommit,
}: {
  readonly label: string;
  readonly value: number;
  readonly step?: number;
  readonly onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (Number.isFinite(next)) onCommit(next);
    else setDraft(String(value));
  };
  return (
    <input
      type="number"
      aria-label={`${label} numeric value`}
      value={draft}
      step={step}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

export function groupParameters(items: readonly VisualParameterDefinition[]) {
  return [...new Set(items.map((item) => item.subcategory ?? ""))].map(
    (name) => ({
      name,
      items: items.filter((item) => (item.subcategory ?? "") === name),
    }),
  );
}
