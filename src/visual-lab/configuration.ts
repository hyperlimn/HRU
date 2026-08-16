import type { Color, WebGLRenderer } from 'three';
import type { VisualConfiguration, VisualValue } from './types';

export const numberValue = (values: VisualConfiguration, id: string): number => values[id] as number;
export const booleanValue = (values: VisualConfiguration, id: string): boolean => values[id] as boolean;
export const stringValue = (values: VisualConfiguration, id: string): string => values[id] as string;
export const vectorValue = (values: VisualConfiguration, id: string): readonly [number, number, number] => values[id] as readonly [number, number, number];
export function sameVisualValue(a: VisualValue, b: VisualValue): boolean { return Array.isArray(a) && Array.isArray(b) ? a.every((value, index) => value === b[index]) : a === b; }
export function applyColor(target: Color, value: string): void { target.set(value); }
export function rendererTelemetry(renderer: Pick<WebGLRenderer, 'info'>, entityMeshes: number, relationshipMeshes: number) {
  return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, entityMeshes, relationshipMeshes };
}
