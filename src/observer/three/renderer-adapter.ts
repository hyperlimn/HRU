import * as THREE from 'three';
import type { ObservationFrame, RelationshipEvent } from '../observation-types';
import type { HashHex } from '../../shared/ids';
import { ZERO_CONTEXT_HEX } from '../../core/state';
import { dimensionZeroPosition } from '../dimension-0';
import { renderTraits } from '../render-traits';
import type { RenderChannelId } from '../render-channels';
import type { VisualEvent } from '../observer-state';

export type ChannelVisibility = Readonly<Record<RenderChannelId, boolean>>;

export class InstanceSelectionMap {
  private readonly values = new Map<string, HashHex>();
  set(object: THREE.Object3D, instanceId: number, hash: HashHex): void { this.values.set(`${object.uuid}:${instanceId}`, hash); }
  get(object: THREE.Object3D, instanceId: number): HashHex | undefined { return this.values.get(`${object.uuid}:${instanceId}`); }
  clear(): void { this.values.clear(); }
}

export function applyChannelVisibility(groups: Readonly<Record<RenderChannelId, THREE.Object3D>>, channels: ChannelVisibility): void {
  for (const id of Object.keys(groups) as RenderChannelId[]) groups[id].visible = channels[id];
}

export class ThreeObservationRenderer {
  readonly selectionMap = new InstanceSelectionMap(); private readonly groups: Record<RenderChannelId, THREE.Group>;
  private frame?: ObservationFrame; private selected?: HashHex; private entityMeshes: THREE.InstancedMesh[] = [];
  private readonly seenEvents = new Set<string>();

  constructor(private readonly scene: THREE.Scene) {
    this.groups = Object.fromEntries((['entities','positive-bonds','repulsion','clusters','contexts','phase-effects','ancestry','condensed-entities','dimension-effects'] as RenderChannelId[]).map((id) => [id, new THREE.Group()])) as Record<RenderChannelId, THREE.Group>;
    for (const [id, group] of Object.entries(this.groups)) { group.name = `observation:${id}`; scene.add(group); }
    this.groups['dimension-effects'].add(new THREE.GridHelper(30, 30, 0x193345, 0x101923));
    this.groups['dimension-effects'].position.y = -12;
  }

  update(frame: ObservationFrame, events: readonly VisualEvent[]): void {
    if (this.frame?.stateDigest !== frame.stateDigest) { this.frame = frame; this.rebuildCurrent(); }
    for (const visual of events) if (!this.seenEvents.has(visual.event.eventId) && this.addTransient(visual.event, visual.observedAt)) this.seenEvents.add(visual.event.eventId);
    if (this.seenEvents.size > 2048) this.seenEvents.clear();
  }
  setChannels(channels: ChannelVisibility): void { applyChannelVisibility(this.groups, channels); }
  setSelection(hash?: HashHex): void { this.selected = hash; this.rebuildSelection(); }
  raycastTargets(): readonly THREE.InstancedMesh[] { return this.entityMeshes; }
  selectedHash(intersection: THREE.Intersection): HashHex | undefined { return intersection.instanceId === undefined ? undefined : this.selectionMap.get(intersection.object, intersection.instanceId); }
  animate(now: number): void {
    for (const object of [...this.groups['phase-effects'].children]) {
      const start = object.userData.start as number; const expires = object.userData.expires as number; const progress = Math.max(0, Math.min(1, (now - start) / (expires - start)));
      const material = (object as THREE.Mesh).material as THREE.Material & { opacity?: number }; if ('opacity' in material) material.opacity = 1 - progress;
      object.scale.setScalar(1 + progress * 2); if (now >= expires) { this.groups['phase-effects'].remove(object); disposeObject(object); }
    }
  }
  dispose(): void { for (const group of Object.values(this.groups)) { clearGroup(group); this.scene.remove(group); } }

  private rebuildCurrent(): void {
    for (const id of ['entities','positive-bonds','repulsion','clusters','contexts','ancestry','condensed-entities'] as RenderChannelId[]) clearGroup(this.groups[id]);
    this.selectionMap.clear(); this.entityMeshes = []; if (!this.frame) return;
    const positions = new Map(this.frame.entities.map((entity) => { const position = dimensionZeroPosition(entity.hash); return [entity.hash, new THREE.Vector3(position.x, position.y, position.z)] as const; }));
    const geometries = [new THREE.IcosahedronGeometry(1, 1), new THREE.OctahedronGeometry(1, 1), new THREE.DodecahedronGeometry(1, 0)];
    for (let variation = 0; variation < 3; variation += 1) {
      const entities = this.frame.entities.filter((entity) => renderTraits(entity.hash, entity.provenance, entity.contextHash, Boolean(entity.clusterHash)).geometryVariation === variation);
      if (!entities.length) { geometries[variation]!.dispose(); continue; }
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15, emissive: 0x061824, emissiveIntensity: 0.5 });
      const mesh = new THREE.InstancedMesh(geometries[variation]!, material, entities.length); mesh.userData.observationEntities = true;
      entities.forEach((entity, index) => {
        const traits = renderTraits(entity.hash, entity.provenance, entity.contextHash, Boolean(entity.clusterHash));
        const matrix = new THREE.Matrix4().compose(positions.get(entity.hash)!, new THREE.Quaternion().setFromEuler(new THREE.Euler(...traits.orientation)), new THREE.Vector3(traits.size, traits.size, traits.size));
        mesh.setMatrixAt(index, matrix); mesh.setColorAt(index, new THREE.Color().setHSL(traits.baseHue, 0.72, entity.provenance.origin === 'genesis' ? 0.68 : 0.55)); this.selectionMap.set(mesh, index, entity.hash);
      });
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; this.groups.entities.add(mesh); this.entityMeshes.push(mesh);
    }
    for (const bond of this.frame.bonds) {
      const positive = bond.strength >= 0; const active = bond.classification === 'active-positive' || bond.classification === 'active-repulsion';
      const material = new THREE.MeshBasicMaterial({ color: positive ? 0x52d8ff : 0xff4f9b, transparent: true, opacity: (active ? 0.72 : 0.22) + Math.abs(bond.strength) * 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
      const connection = cylinderBetween(positions.get(bond.low)!, positions.get(bond.high)!, active ? 0.035 : 0.014, material);
      this.groups[positive ? 'positive-bonds' : 'repulsion'].add(connection);
    }
    for (const cluster of this.frame.clusters) {
      const points = cluster.memberHashes.map((hash) => positions.get(hash)!); const center = centroid(points); const radius = Math.max(0.5, ...points.map((point) => point.distanceTo(center))) + 0.35;
      this.groups.clusters.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), new THREE.MeshBasicMaterial({ color: 0x58cbe8, wireframe: true, transparent: true, opacity: 0.1 })));
      this.groups.clusters.children.at(-1)!.position.copy(center);
    }
    for (const entity of this.frame.entities) if (entity.contextHash !== ZERO_CONTEXT_HEX) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(renderTraits(entity.hash, entity.provenance, entity.contextHash, true).accentHue, 0.75, 0.6), transparent: true, opacity: 0.45 })); ring.position.copy(positions.get(entity.hash)!); this.groups.contexts.add(ring); }
    for (const record of this.frame.condensationRecords) {
      const child = positions.get(record.entityHash); if (!child) continue;
      const accent = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd37a, wireframe: true, transparent: true, opacity: 0.45 })); accent.position.copy(child); this.groups['condensed-entities'].add(accent);
      for (const parent of record.parentHashes) if (positions.has(parent)) this.groups.ancestry.add(cylinderBetween(child, positions.get(parent)!, 0.008, new THREE.MeshBasicMaterial({ color: 0xffd37a, transparent: true, opacity: 0.18 })));
    }
    this.rebuildSelection();
  }
  private rebuildSelection(): void {
    const existing = this.groups.entities.getObjectByName('selection-highlight'); if (existing) { this.groups.entities.remove(existing); disposeObject(existing); }
    if (!this.selected || !this.frame?.entities.some((entity) => entity.hash === this.selected)) return;
    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.75 }));
    const position = dimensionZeroPosition(this.selected); highlight.position.set(position.x, position.y, position.z); highlight.name = 'selection-highlight'; this.groups.entities.add(highlight);
  }
  private addTransient(event: RelationshipEvent, observedAt: number): boolean {
    if (!this.frame) return false; const positions = new Map(this.frame.entities.map((entity) => { const p = dimensionZeroPosition(entity.hash); return [entity.hash, new THREE.Vector3(p.x,p.y,p.z)] as const; }));
    let object: THREE.Mesh | undefined;
    if ((event.type === 'cluster-formed' || event.type === 'cluster-dissolved') && event.participants.every((hash) => positions.has(hash))) {
      const center = centroid(event.participants.map((hash) => positions.get(hash)!)); object = new THREE.Mesh(new THREE.SphereGeometry(0.7,14,9),new THREE.MeshBasicMaterial({color:0x68d8e8,wireframe:true,transparent:true,opacity:0.75})); object.position.copy(center);
    } else if (event.participants.length >= 2 && positions.has(event.participants[0]!) && positions.has(event.participants[1]!)) {
      object = cylinderBetween(positions.get(event.participants[0]!)!, positions.get(event.participants[1]!)!, event.type === 'bond-dissolved' ? 0.02 : 0.045, new THREE.MeshBasicMaterial({ color: event.type.includes('negative') || event.type.includes('repulsion') ? 0xff4f9b : 0x7cecff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    } else if (positions.has(event.participants[0]!)) {
      object = new THREE.Mesh(new THREE.SphereGeometry(event.type === 'entity-condensed' ? 0.65 : 0.45, 14, 9), new THREE.MeshBasicMaterial({ color: event.type === 'entity-condensed' ? 0xffd37a : 0x8effc1, wireframe: true, transparent: true, opacity: 0.9 })); object.position.copy(positions.get(event.participants[0]!)!);
    }
    if (object) { object.userData.start = observedAt; object.userData.expires = observedAt + 2500; this.groups['phase-effects'].add(object); return true; }
    return false;
  }
}

function centroid(points: readonly THREE.Vector3[]): THREE.Vector3 { return points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length); }
function cylinderBetween(start: THREE.Vector3, end: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh { const direction = new THREE.Vector3().subVectors(end, start); const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6, 1, true), material); mesh.position.copy(start).add(end).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction.normalize()); return mesh; }
function disposeObject(object: THREE.Object3D): void { const mesh = object as THREE.Mesh; if (mesh.geometry) mesh.geometry.dispose(); if (mesh.material) { const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; materials.forEach((material) => material.dispose()); } }
function clearGroup(group: THREE.Group): void { for (const child of [...group.children]) { group.remove(child); child.traverse(disposeObject); } }
