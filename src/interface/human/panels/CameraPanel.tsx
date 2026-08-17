import { useEffect, useState } from "react";
import { Disclosure } from "../components/Disclosure";
import {
  OPEN_VISUAL_CONTROL_EVENT,
  ParameterControl,
  groupParameters,
  revealVisualControl,
} from "../../../visual-lab/VisualControls";
import { useVisualLab } from "../../../visual-lab/visual-lab-context";

export function CameraPanel() {
  const { state, schema, error, clearError, execute, setValue } =
    useVisualLab();
  const [targetId, setTargetId] = useState<string>();
  useEffect(() => {
    const open = (event: Event) => {
      const id = (event as CustomEvent<{ id: string }>).detail.id;
      if (!id.startsWith("camera.")) return;
      setTargetId(id);
      window.setTimeout(() => revealVisualControl(id), 50);
    };
    window.addEventListener(OPEN_VISUAL_CONTROL_EVENT, open);
    return () => window.removeEventListener(OPEN_VISUAL_CONTROL_EVENT, open);
  }, []);
  if (!state) return <small>Connecting to camera controls…</small>;
  const parameters = schema.filter(
    (parameter) =>
      parameter.category === "Camera" &&
      (state.showAdvanced || !parameter.advanced),
  );
  return (
    <div className="camera-panel">
      <p>
        Observer camera and viewport rendering. The discreet viewport menu uses
        this same state.
      </p>
      {error && (
        <div className="visual-error" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss camera error" onClick={clearError}>
            ×
          </button>
        </div>
      )}
      {groupParameters(parameters).map(({ name, items }) => (
        <Disclosure
          key={name || "camera"}
          title={name || "Camera"}
          count={items.length}
          defaultOpen={name === "Navigation / Projection"}
          forceOpen={items.some(({ id }) => id === targetId)}
        >
          {items.map((parameter) => (
            <ParameterControl
              key={parameter.id}
              parameter={parameter}
              value={state.values[parameter.id]!}
              favorite={state.favorites.includes(parameter.id)}
              onValue={(value) => setValue(parameter.id, value)}
              onReset={() =>
                void execute({
                  type: "visual-lab/reset-parameter",
                  id: parameter.id,
                }).catch(() => undefined)
              }
              onFavorite={() =>
                void execute({
                  type: "visual-lab/favorite/toggle",
                  id: parameter.id,
                }).catch(() => undefined)
              }
            />
          ))}
        </Disclosure>
      ))}
    </div>
  );
}
