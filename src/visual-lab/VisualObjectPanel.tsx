import { useEffect, useMemo, useState } from "react";
import { Disclosure } from "../interface/human/components/Disclosure";
import { useObserverState } from "../observer/observer-state";
import {
  formatVisualObjectState,
  resolveEffectiveVisualObject,
  type VisualResolutionMeasurements,
} from "../observer/visual-object";
import { useVisualLab } from "./visual-lab-context";
import { useActivity } from "../activity/activity-context";

export function VisualObjectPanel({
  onOpenControl,
}: {
  readonly onOpenControl: (id: string) => void;
}) {
  const { frame, selectedVisual, visualEvents } = useObserverState();
  const { state, palettes, schema } = useVisualLab();
  const { record } = useActivity();
  const [measurements, setMeasurements] =
    useState<VisualResolutionMeasurements>();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  useEffect(() => {
    const listener = (event: Event) =>
      setMeasurements(
        (event as CustomEvent<VisualResolutionMeasurements>).detail,
      );
    window.addEventListener("hru:visual-measurements", listener);
    return () =>
      window.removeEventListener("hru:visual-measurements", listener);
  }, []);
  const effective = useMemo(
    () =>
      frame && selectedVisual && state
        ? resolveEffectiveVisualObject(frame, selectedVisual, state.values, {
            palettes,
            measurements,
            events: visualEvents.map(({ event }) => event),
          })
        : undefined,
    [frame, selectedVisual, state, palettes, measurements, visualEvents],
  );
  const labels = useMemo(
    () => new Map(schema.map(({ id, label }) => [id, label])),
    [schema],
  );
  const copy = async () => {
    if (!effective) return;
    try {
      await navigator.clipboard.writeText(formatVisualObjectState(effective));
      setCopyStatus("copied");
      record({
        category: "VISUAL",
        level: "info",
        action: "COPY",
        message: `copied visual state for ${effective.type} ${effective.sourceIdentity.slice(0, 12)}`,
        origin: "human-ui",
        data: {
          type: effective.type,
          sourceIdentity: effective.sourceIdentity,
        },
      });
    } catch (cause) {
      setCopyStatus("failed");
      record({
        category: "VISUAL",
        level: "error",
        action: "COPY",
        message: `visual state copy failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        origin: "human-ui",
      });
    }
    window.setTimeout(() => setCopyStatus("idle"), 1_400);
  };
  return (
    <Disclosure title="Visual Object" defaultOpen level="category">
      {!effective ? (
        <div className="visual-object-empty">
          <strong>Nothing selected</strong>
          <span>Click a rendered object to inspect it.</span>
        </div>
      ) : (
        <div className="visual-object">
          <header>
            <div>
              <strong>
                {effective.type.toUpperCase().replaceAll("-", " ")}
              </strong>
              <code>{effective.sourceIdentity.slice(0, 12)}…</code>
              <span
                className={`visual-object-state ${effective.renderedState.toLowerCase()}`}
              >
                {effective.renderedState}
              </span>
            </div>
            <button onClick={() => void copy()}>
              {copyStatus === "copied"
                ? "Copied"
                : copyStatus === "failed"
                  ? "Copy failed"
                  : "Copy"}
            </button>
          </header>
          <Disclosure title="Appearance" defaultOpen>
            {effective.attributes.map((attribute) => (
              <div className="effective-row" key={attribute.id}>
                <span>{attribute.label}</span>
                <strong>{formatValue(attribute.effectiveValue)}</strong>
              </div>
            ))}
          </Disclosure>
          <Disclosure title="Effects">
            {effective.effects.length ? (
              effective.effects.map((effect) => (
                <details className="effect-row" key={effect.id}>
                  <summary>
                    <span>{effect.label}</span>
                    <strong
                      className={`status-${effect.status.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {effect.status}
                    </strong>
                  </summary>
                  <p>{effect.summary}</p>
                  {Object.entries(effect.measurements).map(([key, value]) => (
                    <div className="effective-row" key={key}>
                      <span>{humanize(key)}</span>
                      <strong>{formatValue(value)}</strong>
                    </div>
                  ))}
                  {effect.reasons.map((reason) => (
                    <p className="effect-reason" key={reason}>
                      {reason}
                    </p>
                  ))}
                </details>
              ))
            ) : (
              <small>No relevant effects.</small>
            )}
          </Disclosure>
          <Disclosure title="Why">
            {effective.why.map((chain) => (
              <div className="why-chain" key={chain.attribute}>
                <strong>{chain.attribute}</strong>
                {chain.steps.map((step, index) => (
                  <div key={`${step.label}-${index}`}>
                    <span>{step.label}</span>
                    {step.value && <code>{step.value}</code>}
                    {index < chain.steps.length - 1 && <i>↓</i>}
                  </div>
                ))}
              </div>
            ))}
            <div className="palette-diagnostic">
              <strong>PALETTE</strong>
              <div className="effective-row">
                <span>Color mode</span>
                <b>{effective.palette.colorMode}</b>
              </div>
              <div className="effective-row">
                <span>Active palette</span>
                <b>{effective.palette.activePalette}</b>
              </div>
              {effective.palette.semanticRole && (
                <div className="effective-row">
                  <span>Semantic role</span>
                  <b>{effective.palette.semanticRole}</b>
                </div>
              )}
              {effective.palette.sourceFraction !== undefined && (
                <div className="effective-row">
                  <span>Source fraction</span>
                  <b>{effective.palette.sourceFraction.toFixed(5)}</b>
                </div>
              )}
              {effective.palette.palettePosition !== undefined && (
                <div className="effective-row">
                  <span>Palette position</span>
                  <b>{effective.palette.palettePosition.toFixed(5)}</b>
                </div>
              )}
              {effective.palette.resolvedColor && (
                <div className="effective-row">
                  <span>Resolved color</span>
                  <b>{effective.palette.resolvedColor}</b>
                </div>
              )}
              <div className="effective-row">
                <span>Status</span>
                <b>{effective.palette.status}</b>
              </div>
              {effective.palette.reason && (
                <p className="effect-reason">{effective.palette.reason}</p>
              )}
            </div>
          </Disclosure>
          <Disclosure title="Controls">
            {effective.relevantControlIds.map((id) => (
              <div className="control-link" key={id}>
                <span>{labels.get(id) ?? id}</span>
                <button onClick={() => onOpenControl(id)}>Open</button>
              </div>
            ))}
          </Disclosure>
        </div>
      )}
    </Disclosure>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "number")
    return Number.isInteger(value) ? String(value) : value.toFixed(3);
  return String(value);
}
function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (part) => part.toUpperCase());
}
