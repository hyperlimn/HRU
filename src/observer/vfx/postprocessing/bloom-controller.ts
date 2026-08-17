import * as THREE from 'three';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { HashHex } from '../../../shared/ids';
import { booleanValue, numberValue, stringValue, vectorValue } from '../../../visual-lab/configuration';
import type { VisualConfiguration } from '../../../visual-lab/types';
import { dimensionZeroPosition } from '../../dimension-0';
import type { ObservationFrame } from '../../observation-types';
import type { VisualEvent } from '../../observer-state';
import type { VfxTelemetry } from '../shared/types';
import { aggregateRadialBlur, RadialBlurPass } from './radial-blur';

type PostQuality = 'Low' | 'Medium' | 'High';
const QUALITY_SCALE: Readonly<Record<PostQuality, number>> = { Low: 0.5, Medium: 0.75, High: 1 };

function observationPosition(hash: HashHex, values: VisualConfiguration): THREE.Vector3 {
  const projected = dimensionZeroPosition(hash);
  const spread = numberValue(values, 'scene.worldSpread');
  const position = new THREE.Vector3(projected.x * spread, projected.y * spread, projected.z * spread);
  position.applyEuler(new THREE.Euler(...vectorValue(values, 'scene.worldRotation')));
  return position.add(new THREE.Vector3(...vectorValue(values, 'scene.originOffset')));
}

function clusterCenter(memberHashes: readonly HashHex[], values: VisualConfiguration): THREE.Vector3 | undefined {
  if (memberHashes.length === 0) return undefined;
  return memberHashes
    .map((hash) => observationPosition(hash, values))
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / memberHashes.length);
}

/** Resolves the exact focus distance consumed by the Bokeh pass. */
export function resolveDofFocusDistance(
  frame: ObservationFrame,
  selected: HashHex | undefined,
  values: VisualConfiguration,
  cameraPosition: THREE.Vector3,
): number {
  const mode = stringValue(values, 'camera.dof.focusMode');
  let target: THREE.Vector3 | undefined;

  if (mode === 'Selected Entity' && selected && frame.entities.some(({ hash }) => hash === selected)) {
    target = observationPosition(selected, values);
  } else if (mode === "Selected Entity's cluster" && selected) {
    const entity = frame.entities.find(({ hash }) => hash === selected);
    const cluster = entity?.clusterHash
      ? frame.clusters.find(({ clusterHash }) => clusterHash === entity.clusterHash)
      : undefined;
    target = cluster ? clusterCenter(cluster.memberHashes, values) : undefined;
  } else if (mode === 'Largest visible cluster' && frame.clusters.length > 0) {
    const cluster = [...frame.clusters].sort(
      (left, right) => right.memberHashes.length - left.memberHashes.length
        || left.clusterHash.localeCompare(right.clusterHash),
    )[0]!;
    target = clusterCenter(cluster.memberHashes, values);
  } else if (mode === 'Nearest rendered entity') {
    for (const entity of frame.entities) {
      const candidate = observationPosition(entity.hash, values);
      if (!target || candidate.distanceTo(cameraPosition) < target.distanceTo(cameraPosition)) target = candidate;
    }
  }

  return target?.distanceTo(cameraPosition) ?? numberValue(values, 'camera.dof.focusDistance');
}

export class BloomPipeline {
  private composer?: EffectComposer;
  private bloom?: UnrealBloomPass;
  private radial?: RadialBlurPass;
  private dof?: BokehPass;
  private width = 1;
  private height = 1;
  private quality = '';
  private passSignature = '';
  private enabledEffects = 0;
  private radialRequested = 0;
  private radialSamples = 0;
  private dofFocus = 30;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {}

  configure(values: VisualConfiguration): void {
    const bloomEnabled = booleanValue(values, 'vfx.bloom.enabled');
    const selectiveEnabled = booleanValue(values, 'vfx.selective.enabled');
    const radialEnabled = booleanValue(values, 'vfx.radialBlur.enabled');
    const dofEnabled = booleanValue(values, 'camera.dof.enabled');
    const enabled = bloomEnabled || selectiveEnabled || radialEnabled || dofEnabled;
    if (!enabled) {
      this.dispose();
      return;
    }

    const quality = (dofEnabled
      ? stringValue(values, 'camera.dof.quality')
      : radialEnabled
        ? stringValue(values, 'vfx.radialBlur.quality')
        : selectiveEnabled
          ? stringValue(values, 'vfx.selective.quality')
          : stringValue(values, 'vfx.bloom.quality')) as PostQuality;
    const signature = `${dofEnabled}:${radialEnabled}:${bloomEnabled || selectiveEnabled}`;
    if (this.composer && (quality !== this.quality || signature !== this.passSignature)) this.dispose();
    if (!this.composer) this.createComposer(values, quality, { bloom: bloomEnabled || selectiveEnabled, radial: radialEnabled, dof: dofEnabled });

    this.enabledEffects = Number(bloomEnabled) + Number(selectiveEnabled) + Number(radialEnabled) + Number(dofEnabled);
    if (this.bloom) {
      this.bloom.strength = bloomEnabled ? numberValue(values, 'vfx.bloom.strength') : 1;
      this.bloom.radius = numberValue(values, 'vfx.bloom.radius');
      this.bloom.threshold = numberValue(values, 'vfx.bloom.threshold');
    }
    if (this.dof) {
      this.dof.materialBokeh.uniforms.focus.value = this.dofFocus;
      this.dof.materialBokeh.uniforms.aperture.value = numberValue(values, 'camera.dof.blurAmount') * 0.0001;
      this.dof.materialBokeh.uniforms.maxblur.value = numberValue(values, 'camera.dof.maxBlur');
    }
  }

  setDofFocus(frame: ObservationFrame | undefined, selected: HashHex | undefined, values: VisualConfiguration | undefined): void {
    if (!this.dof || !frame || !values) return;
    this.dofFocus = resolveDofFocusDistance(frame, selected, values, this.camera.position);
    this.dof.materialBokeh.uniforms.focus.value = this.dofFocus;
  }

  setRadialState(frame: ObservationFrame | undefined, events: readonly VisualEvent[], selected: HashHex | undefined, values: VisualConfiguration | undefined): void {
    if (!this.radial || !frame || !values) {
      this.radial?.setAggregate(undefined);
      this.radialRequested = 0;
      this.radialSamples = 0;
      return;
    }
    const aggregate = aggregateRadialBlur(frame, events, selected, this.camera, values);
    this.radial.setAggregate(aggregate);
    this.radialRequested = aggregate.requested;
    this.radialSamples = aggregate.samples;
  }

  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.composer?.setSize(width, height);
  }

  render(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  telemetry(): VfxTelemetry {
    return {
      activeEffects: this.enabledEffects,
      postprocessingPasses: this.composer
        ? 2 + Number(Boolean(this.bloom)) + Number(Boolean(this.radial)) + Number(Boolean(this.dof))
        : 0,
      particles: 0,
      geometries: 0,
      drawCalls: this.composer ? 1 : 0,
      estimatedCost: this.composer ? 'medium' : 'none',
      radialRequested: this.radialRequested,
      radialRendered: this.radial?.enabled ? this.radialRequested : 0,
      radialSamples: this.radial?.enabled ? this.radialSamples : 0,
    };
  }

  dispose(): void {
    this.composer?.dispose();
    this.bloom?.dispose();
    this.radial?.dispose();
    this.dof?.dispose();
    this.composer = undefined;
    this.bloom = undefined;
    this.radial = undefined;
    this.dof = undefined;
    this.enabledEffects = 0;
    this.radialRequested = 0;
    this.radialSamples = 0;
  }

  private createComposer(
    values: VisualConfiguration,
    quality: PostQuality,
    enabled: { readonly bloom: boolean; readonly radial: boolean; readonly dof: boolean },
  ): void {
    this.quality = quality;
    this.passSignature = `${enabled.dof}:${enabled.radial}:${enabled.bloom}`;
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.renderer.getPixelRatio() * QUALITY_SCALE[quality]);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Stable pass order: scene -> depth of field -> radial blur -> bloom -> output.
    if (enabled.dof) {
      this.dof = new BokehPass(this.scene, this.camera, {
        focus: numberValue(values, 'camera.dof.focusDistance'),
        aperture: numberValue(values, 'camera.dof.blurAmount') * 0.0001,
        maxblur: numberValue(values, 'camera.dof.maxBlur'),
      });
      this.composer.addPass(this.dof);
    }
    if (enabled.radial) {
      this.radial = new RadialBlurPass();
      this.composer.addPass(this.radial);
    }
    if (enabled.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 1, 0.1, 0.8);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.composer.setSize(this.width, this.height);
  }
}
