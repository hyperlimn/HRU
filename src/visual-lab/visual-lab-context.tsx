import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRuntime } from "../interface/human/runtime-context";
import type {
  RendererTelemetry,
  VisualLabCommand,
  VisualLabState,
  VisualParameterDefinition,
  VisualProfileSummary,
  VisualValue,
} from "./types";
import type { Palette } from "./palettes";
import type { VisualRecipe } from "./recipes";
import type { CommandResult } from "../interface/protocol";
interface VisualLabContextValue {
  state?: VisualLabState;
  schema: readonly VisualParameterDefinition[];
  profiles: readonly VisualProfileSummary[];
  palettes: readonly (Palette & { readonly hash: string })[];
  recipes: readonly VisualRecipe[];
  telemetry: RendererTelemetry;
  error?: string;
  clearError(): void;
  execute(command: VisualLabCommand): Promise<CommandResult>;
  setValue(id: string, value: VisualValue, clamp?: boolean): void;
  refresh(): Promise<void>;
}
const Context = createContext<VisualLabContextValue | undefined>(undefined);
const emptyTelemetry: RendererTelemetry = {
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  entityMeshes: 0,
  relationshipMeshes: 0,
  activeEffects: 0,
  postprocessingPasses: 0,
  vfxParticles: 0,
  vfxGeometries: 0,
  vfxDrawCalls: 0,
  vfxEstimatedCost: "none",
  particleFields: 0,
  particleRequested: 0,
  particleRendered: 0,
  particleUpdateTicks: 0,
  particleCpuMilliseconds: 0,
  vortexRequested: 0,
  vortexRendered: 0,
  vortexVertices: 0,
  vortexUpdateTicks: 0,
  vortexCpuMilliseconds: 0,
};
export function VisualLabProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { connected, command, query, pushedVisualState } = useRuntime();
  const [state, setState] = useState<VisualLabState>();
  const [schema, setSchema] = useState<readonly VisualParameterDefinition[]>(
    [],
  );
  const [profiles, setProfiles] = useState<readonly VisualProfileSummary[]>([]);
  const [palettes, setPalettes] = useState<
    readonly (Palette & { readonly hash: string })[]
  >([]);
  const [recipes, setRecipes] = useState<readonly VisualRecipe[]>([]);
  const [telemetry, setTelemetry] = useState(emptyTelemetry);
  const [error, setError] = useState<string>();
  const pendingValues = useRef(
    new Map<string, { timer: number; value: VisualValue; clamp: boolean }>(),
  );
  const refresh = useCallback(async () => {
    const [
      schemaResult,
      stateResult,
      profilesResult,
      palettesResult,
      recipesResult,
    ] = await Promise.all([
      query({ type: "visual-lab/schema" }),
      query({ type: "visual-lab/state" }),
      query({ type: "visual-lab/profiles/list" }),
      query({ type: "visual-lab/palettes/list" }),
      query({ type: "visual-lab/recipes/list" }),
    ]);
    if (schemaResult.ok)
      setSchema(
        (
          schemaResult.data as {
            parameters: readonly VisualParameterDefinition[];
          }
        ).parameters,
      );
    if (stateResult.ok) setState(stateResult.data as VisualLabState);
    if (profilesResult.ok)
      setProfiles(profilesResult.data as readonly VisualProfileSummary[]);
    if (palettesResult.ok)
      setPalettes(
        palettesResult.data as readonly (Palette & { hash: string })[],
      );
    if (recipesResult.ok)
      setRecipes(recipesResult.data as readonly VisualRecipe[]);
  }, [query]);
  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);
  useEffect(() => {
    if (pushedVisualState) setState(pushedVisualState);
  }, [pushedVisualState]);
  useEffect(() => {
    const listener = (event: Event) =>
      setTelemetry((event as CustomEvent<RendererTelemetry>).detail);
    window.addEventListener("hru:renderer-telemetry", listener);
    return () => window.removeEventListener("hru:renderer-telemetry", listener);
  }, []);
  const execute = useCallback(
    async (value: VisualLabCommand) => {
      const result = await command(value);
      if (!result.ok) {
        const message = result.message ?? "Visual Lab command failed";
        setError(message);
        throw new Error(message);
      }
      setError(undefined);
      if (!value.type.endsWith("/export"))
        setState(result.data as VisualLabState);
      if (
        value.type.startsWith("visual-lab/profile/") ||
        value.type.startsWith("visual-lab/palette/")
      )
        await refresh();
      return result;
    },
    [command, refresh],
  );
  useEffect(
    () => () => {
      for (const pending of pendingValues.current.values())
        window.clearTimeout(pending.timer);
      pendingValues.current.clear();
    },
    [],
  );
  const setValue = useCallback(
    (id: string, value: VisualValue, clamp = false) => {
      setState((current) =>
        current
          ? {
              ...current,
              values: { ...current.values, [id]: value },
              dirty: true,
            }
          : current,
      );
      const previous = pendingValues.current.get(id);
      if (previous) window.clearTimeout(previous.timer);
      const timer = window.setTimeout(() => {
        pendingValues.current.delete(id);
        void execute({ type: "visual-lab/value/set", id, value, clamp }).catch(
          () => refresh(),
        );
      }, 50);
      pendingValues.current.set(id, { timer, value, clamp });
    },
    [execute, refresh],
  );
  const clearError = useCallback(() => setError(undefined), []);
  const value = useMemo(
    () => ({
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
      refresh,
    }),
    [
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
      refresh,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useVisualLab(): VisualLabContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("useVisualLab must be inside VisualLabProvider");
  return value;
}
