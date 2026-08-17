export type VisualValue = number | boolean | string | readonly [number, number, number];
export type VisualParameterType = 'number' | 'boolean' | 'color' | 'select' | 'vector3' | 'palette-id';
export type VisualUpdateMode = 'immediate' | 'scene-object' | 'geometry-rebuild' | 'renderer-recreation';
export type PerformanceCost = 'negligible' | 'low' | 'medium' | 'high';
export interface VisualParameterDefinition {
  readonly id: string;
  /** Stable reset/service grouping. */
  readonly group: string;
  /** Sidebar hierarchy supplied by the visual module. */
  readonly category: string;
  readonly subcategory?: string;
  readonly categoryOrder: number;
  readonly label: string;
  readonly description: string;
  readonly type: VisualParameterType;
  readonly defaultValue: VisualValue;
  /** Hard technical validity bounds. Typed input may use the complete hard range. */
  readonly min?: number;
  readonly max?: number;
  /** Convenience slider range, never an import/service validity boundary. */
  readonly sliderMin?: number;
  readonly sliderMax?: number;
  readonly step?: number;
  readonly integer?: boolean;
  readonly options?: readonly string[];
  readonly updateMode: VisualUpdateMode;
  readonly performanceCost: PerformanceCost;
  readonly advanced: boolean;
}
export type VisualConfiguration = Readonly<Record<string,VisualValue>>;
export interface VisualProfile { readonly formatVersion:1;readonly name:string;readonly schemaVersion:string;readonly values:VisualConfiguration;readonly description?:string;readonly builtIn:boolean;readonly metadata?:{readonly createdAt?:string;readonly updatedAt?:string} }
export interface VisualProfileSummary {readonly name:string;readonly hash:string;readonly builtIn:boolean;readonly description?:string}
export interface VisualLabState {readonly schemaVersion:string;readonly values:VisualConfiguration;readonly activeProfile:string;readonly activeProfileHash:string;readonly paletteWarning?:string;readonly dirty:boolean;readonly canUndo:boolean;readonly canRedo:boolean;readonly favorites:readonly string[];readonly showAdvanced:boolean;readonly favoritesOnly:boolean;readonly ab:{readonly active?:'A'|'B';readonly A?:VisualConfiguration;readonly B?:VisualConfiguration;readonly differingParameters:readonly string[]}}
export interface RendererTelemetry {readonly fps:number;readonly drawCalls:number;readonly triangles:number;readonly geometries:number;readonly textures:number;readonly entityMeshes:number;readonly relationshipMeshes:number;readonly activeEffects:number;readonly postprocessingPasses:number;readonly vfxParticles:number;readonly vfxGeometries:number;readonly vfxDrawCalls:number;readonly vfxEstimatedCost:string;readonly particleFields:number;readonly particleRequested:number;readonly particleRendered:number;readonly particleUpdateTicks:number;readonly particleCpuMilliseconds:number;readonly vortexRequested:number;readonly vortexRendered:number;readonly vortexVertices:number;readonly vortexUpdateTicks:number;readonly vortexCpuMilliseconds:number}
export type VisualLabCommand=
|{readonly type:'visual-lab/value/set';readonly id:string;readonly value:VisualValue;readonly clamp?:boolean}
|{readonly type:'visual-lab/values/patch';readonly values:Readonly<Record<string,VisualValue>>;readonly clamp?:boolean}
|{readonly type:'visual-lab/reset-parameter';readonly id:string}|{readonly type:'visual-lab/reset-group';readonly group:string}|{readonly type:'visual-lab/reset-all'}
|{readonly type:'visual-lab/undo'}|{readonly type:'visual-lab/redo'}
|{readonly type:'visual-lab/profile/save';readonly name:string;readonly description?:string}|{readonly type:'visual-lab/profile/load';readonly name:string}
|{readonly type:'visual-lab/profile/duplicate';readonly source:string;readonly name:string}|{readonly type:'visual-lab/profile/rename';readonly source:string;readonly name:string}
|{readonly type:'visual-lab/profile/delete';readonly name:string}|{readonly type:'visual-lab/profile/import';readonly json:string}|{readonly type:'visual-lab/profile/export';readonly name:string}
|{readonly type:'visual-lab/ab/store';readonly slot:'A'|'B'}|{readonly type:'visual-lab/ab/toggle'}
|{readonly type:'visual-lab/favorite/toggle';readonly id:string}|{readonly type:'visual-lab/preference/set';readonly preference:'showAdvanced'|'favoritesOnly';readonly value:boolean}|VisualRecipeCommand|VisualPaletteCommand;
export type VisualPaletteCommand={readonly type:'visual-lab/palette/select';readonly id:string}|{readonly type:'visual-lab/palette/create';readonly palette:import('./palettes').Palette}|{readonly type:'visual-lab/palette/update';readonly palette:import('./palettes').Palette}|{readonly type:'visual-lab/palette/duplicate';readonly source:string;readonly name:string}|{readonly type:'visual-lab/palette/rename';readonly id:string;readonly name:string}|{readonly type:'visual-lab/palette/delete';readonly id:string}|{readonly type:'visual-lab/palette/import';readonly json:string}|{readonly type:'visual-lab/palette/export';readonly id:string};
export type VisualRecipeCommand={readonly type:'visual-lab/recipe/apply';readonly id:string};
export type VisualLabQuery={readonly type:'visual-lab/schema'}|{readonly type:'visual-lab/state'}|{readonly type:'visual-lab/profiles/list'}|{readonly type:'visual-lab/recipes/list'}|{readonly type:'visual-lab/palettes/list'}|{readonly type:'visual-lab/palette/get';readonly id:string};
