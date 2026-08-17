export type VfxTarget =
  | "World"
  | "Entities"
  | "Selected Entity"
  | "Positive Bonds"
  | "Weak Bonds"
  | "Repulsion"
  | "Relationships"
  | "Clusters"
  | "Contexts"
  | "Condensed Entities"
  | "Events";
export type VfxStatus = "functional" | "prepared" | "unavailable";
export type VfxPerformance = "low" | "medium" | "high";
export interface RendererCapabilities {
  readonly backend: "webgl" | "webgpu" | "unknown";
  readonly webgl: boolean;
  readonly webgpu: boolean;
  readonly nativeWebgpu: boolean;
  readonly tsl: boolean;
  readonly postprocessing: boolean;
  readonly mrt: boolean;
  readonly compute: boolean;
}
export interface VfxRequirement {
  readonly capability: keyof RendererCapabilities;
  readonly reason: string;
}
export interface VfxModuleDefinition {
  readonly id: string;
  readonly label: string;
  readonly status: VfxStatus;
  readonly requirements: readonly VfxRequirement[];
  readonly targets: readonly VfxTarget[];
  readonly intendedParameters: readonly string[];
  readonly performance: VfxPerformance;
}
export interface VfxTelemetry {
  readonly activeEffects: number;
  readonly postprocessingPasses: number;
  readonly particles: number;
  readonly geometries: number;
  readonly drawCalls: number;
  readonly estimatedCost: VfxPerformance | "none";
  readonly radialRequested?: number;
  readonly radialRendered?: number;
  readonly radialSamples?: number;
}
