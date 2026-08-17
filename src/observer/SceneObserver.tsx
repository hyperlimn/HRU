import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useObserverState } from "./observer-state";
import { ThreeObservationRenderer } from "./three/renderer-adapter";
import { useVisualLab } from "../visual-lab/visual-lab-context";
import {
  booleanValue,
  numberValue,
  stringValue,
  vectorValue,
  rendererTelemetry,
} from "../visual-lab/configuration";
import type { VisualConfiguration, VisualValue } from "../visual-lab/types";
import { BloomPipeline } from "./vfx/postprocessing/bloom-controller";
import {
  paletteColor,
  paletteChannelColor,
  type Palette,
} from "../visual-lab/palettes";
import { transformedEntityVisual } from "../visual-lab/transform";
import { sameVisualSelection, type VisualSelection } from "./visual-object";
import { useActivity } from "../activity/activity-context";

export function SceneObserver() {
  const host = useRef<HTMLDivElement>(null);
  const adapter = useRef<ThreeObservationRenderer | undefined>(undefined);
  const { record } = useActivity();
  const {
    frame,
    visualEvents,
    channels,
    selectedVisual,
    selectedHash,
    select,
  } = useObserverState();
  const { state: visualState, setValue, palettes } = useVisualLab();
  const environment = useRef<
    Parameters<typeof applyEnvironment>[0] | undefined
  >(undefined);
  const bloomRef = useRef<BloomPipeline | undefined>(undefined);
  const measurementState = useRef<{
    frame?: typeof frame;
    selection?: VisualSelection;
    values?: VisualConfiguration;
    palettes: readonly Palette[];
  }>({ palettes: [] });
  useEffect(() => {
    measurementState.current = {
      frame,
      selection: selectedVisual,
      values: visualState?.values,
      palettes,
    };
  }, [frame, selectedVisual, visualState, palettes]);
  const warned = useRef(new Set<string>());
  useEffect(() => {
    if (!frame || !visualState) return;
    for (const prefix of [
      "vfx.selective",
      "vfx.particleField",
      "vfx.vortexField",
    ] as const) {
      const enabled = visualState.values[`${prefix}.enabled`] === true,
        target = String(visualState.values[`${prefix}.target`]),
        count = visualTargetCount(
          frame,
          target,
          Boolean(selectedHash),
          visualEvents.length,
        );
      const key = `${prefix}:${target}`;
      if (enabled && count === 0 && !warned.current.has(key)) {
        warned.current.add(key);
        record({
          category: "VFX",
          level: "warning",
          action: "NO_TARGET",
          message: `${prefix.split(".").at(-1)} enabled but no eligible ${target.toLowerCase()} targets`,
          origin: "observer",
          data: { feature: prefix, target },
        });
      }
      if (!enabled || count > 0) warned.current.delete(key);
    }
  }, [frame, visualEvents, visualState, selectedHash, record]);
  useEffect(() => {
    if (frame) {
      adapter.current?.update(frame, visualEvents);
      bloomRef.current?.setRadialState(
        frame,
        visualEvents,
        selectedHash,
        visualState?.values,
      );
      bloomRef.current?.setDofFocus(frame, selectedHash, visualState?.values);
    }
  }, [frame, visualEvents, selectedHash]);
  useEffect(() => adapter.current?.setChannels(channels), [channels]);
  useEffect(() => adapter.current?.setSelection(selectedHash), [selectedHash]);
  useEffect(() => {
    adapter.current?.setPaletteLibrary(palettes);
    if (environment.current && visualState)
      applyEnvironment(environment.current, visualState.values, palettes);
  }, [palettes]);
  useEffect(() => {
    if (visualState) {
      adapter.current?.setVisualConfiguration(visualState.values);
      if (environment.current)
        applyEnvironment(environment.current, visualState.values, palettes);
      bloomRef.current?.configure(visualState.values);
      if (frame) {
        bloomRef.current?.setRadialState(
          frame,
          visualEvents,
          selectedHash,
          visualState.values,
        );
        bloomRef.current?.setDofFocus(frame, selectedHash, visualState.values);
      }
    }
  }, [visualState]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090f);
    scene.fog = new THREE.FogExp2(0x07090f, 0.025);
    const camera = new THREE.PerspectiveCamera(
      55,
      innerWidth / innerHeight,
      0.1,
      200,
    );
    camera.position.set(16, 12, 22);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const ambient = new THREE.AmbientLight(0x6688aa, 1.3),
      primary = new THREE.PointLight(0x8bd9ff, 45),
      fill = new THREE.PointLight(0x8b72ff, 16);
    primary.position.set(7, 12, 9);
    fill.position.set(-10, -4, -6);
    scene.add(ambient, primary, fill);
    const observation = new ThreeObservationRenderer(scene);
    observation.setPaletteLibrary(palettes);
    const bloom = new BloomPipeline(renderer, scene, camera);
    bloomRef.current = bloom;
    adapter.current = observation;
    environment.current = {
      scene,
      camera,
      renderer,
      controls,
      ambient,
      primary,
      fill,
    };
    if (visualState) {
      observation.setVisualConfiguration(visualState.values);
      applyEnvironment(environment.current, visualState.values, palettes);
      bloom.configure(visualState.values);
    }
    observation.setChannels(channels);
    if (frame) {
      observation.update(frame, visualEvents);
      bloom.setRadialState(
        frame,
        visualEvents,
        selectedHash,
        visualState?.values,
      );
    }
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    const pointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
    };
    const pointerUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 4) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        [...observation.raycastTargets()],
        true,
      )[0];
      select(hit ? observation.visualSelection(hit) : undefined);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    let frameId = 0,
      frames = 0,
      fpsStarted = performance.now();
    const render = () => {
      frameId = requestAnimationFrame(render);
      controls.update();
      const expiredSelections = observation.animate(performance.now());
      if (
        measurementState.current.selection &&
        expiredSelections.some((expired) =>
          sameVisualSelection(expired, measurementState.current.selection),
        )
      )
        select(undefined);
      bloom.render();
      frames += 1;
      const now = performance.now();
      if (now - fpsStarted >= 500) {
        const fps = (frames * 1000) / (now - fpsStarted),
          vfx = bloom.telemetry(),
          particles = observation.particleTelemetry(),
          vortices = observation.vortexTelemetry();
        window.dispatchEvent(
          new CustomEvent("hru:render-fps", { detail: fps }),
        );
        window.dispatchEvent(
          new CustomEvent("hru:renderer-telemetry", {
            detail: {
              ...rendererTelemetry(
                renderer,
                observation.raycastTargets().length,
                scene.getObjectByName("observation:positive-bonds")?.children
                  .length ?? 0,
              ),
              fps,
              activeEffects:
                vfx.activeEffects +
                (particles.activeFields > 0 ? 1 : 0) +
                (vortices.rendered > 0 ? 1 : 0),
              postprocessingPasses: vfx.postprocessingPasses,
              vfxParticles: particles.rendered,
              vfxGeometries: particles.buffers,
              vfxDrawCalls:
                vfx.drawCalls + particles.drawCalls + vortices.drawCalls,
              vfxEstimatedCost:
                particles.activeFields > 0 || vortices.rendered > 0
                  ? "high"
                  : vfx.estimatedCost,
              particleFields: particles.activeFields,
              particleRequested: particles.requested,
              particleRendered: particles.rendered,
              particleUpdateTicks: particles.updateTicks,
              particleCpuMilliseconds: particles.cpuMilliseconds,
              vortexRequested: vortices.requested,
              vortexRendered: vortices.rendered,
              vortexVertices: vortices.vertices,
              vortexUpdateTicks: vortices.updateTicks,
              vortexCpuMilliseconds: vortices.cpuMilliseconds,
              radialRequested: vfx.radialRequested ?? 0,
              radialRendered: vfx.radialRendered ?? 0,
              radialSamples: vfx.radialSamples ?? 0,
            },
          }),
        );
        const current = measurementState.current;
        if (
          current.selection?.type === "entity" &&
          current.frame &&
          current.values
        ) {
          const entity = current.frame.entities.find(
            ({ hash }) => hash === current.selection!.sourceIdentity,
          );
          if (entity) {
            const visual = transformedEntityVisual(
                entity,
                current.values,
                current.palettes,
              ),
              rotation = vectorValue(current.values, "scene.worldRotation"),
              origin = vectorValue(current.values, "scene.originOffset"),
              position = new THREE.Vector3(
                visual.position.x,
                visual.position.y,
                visual.position.z,
              )
                .applyEuler(new THREE.Euler(...rotation))
                .add(new THREE.Vector3(...origin)),
              distance = position.distanceTo(camera.position),
              axes = vectorValue(current.values, "entity.scaleAxes"),
              radius = visual.size * Math.max(...axes),
              projectedDiameterPx =
                (radius * renderer.domElement.clientHeight) /
                (Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) *
                  Math.max(0.001, distance));
            window.dispatchEvent(
              new CustomEvent("hru:visual-measurements", {
                detail: {
                  cameraDistance: distance,
                  projectedDiameterPx,
                  viewportHeightPx: renderer.domElement.clientHeight,
                  rendererSupported: true,
                  postprocessingActive: Boolean(
                    current.values["vfx.bloom.enabled"] ||
                      current.values["vfx.selective.enabled"] ||
                      current.values["vfx.radialBlur.enabled"] ||
                      current.values["camera.dof.enabled"],
                  ),
                },
              }),
            );
          }
        }
        frames = 0;
        fpsStarted = now;
      }
    };
    render();
    const resize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      bloom.setSize(innerWidth, innerHeight);
    };
    addEventListener("resize", resize);
    resize();
    return () => {
      cancelAnimationFrame(frameId);
      removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      controls.dispose();
      bloom.dispose();
      observation.dispose();
      renderer.dispose();
      element.removeChild(renderer.domElement);
      adapter.current = undefined;
      environment.current = undefined;
      bloomRef.current = undefined;
    };
  }, []);
  const autoOrbit = Boolean(visualState?.values["camera.autoRotate"]);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const showCamera = Boolean(
    visualState?.values["camera.showViewportControls"],
  );
  const set = (id: string, value: VisualValue) => setValue(id, value);
  return (
    <>
      <div className="scene" ref={host} />
      <div className="viewport-controls">
        <button
          className="viewport-camera-toggle"
          aria-expanded={cameraMenuOpen}
          hidden={!showCamera}
          onClick={() => setCameraMenuOpen((open) => !open)}
        >
          Camera {cameraMenuOpen ? "▴" : "▾"}
        </button>
        <button
          className={
            autoOrbit ? "viewport-auto-orbit active" : "viewport-auto-orbit"
          }
          aria-pressed={autoOrbit}
          onClick={() => setValue("camera.autoRotate", !autoOrbit)}
        >
          <span />
          Orbit
        </button>
        {cameraMenuOpen && showCamera && visualState && (
          <div className="viewport-camera-menu">
            <label>
              FOV
              <input
                type="number"
                value={Number(visualState.values["camera.fov"])}
                onChange={(e) => set("camera.fov", Number(e.target.value))}
              />
            </label>
            <label>
              Depth of Field
              <input
                type="checkbox"
                checked={Boolean(visualState.values["camera.dof.enabled"])}
                onChange={(e) => set("camera.dof.enabled", e.target.checked)}
              />
            </label>
            <label>
              Focus mode
              <select
                value={String(visualState.values["camera.dof.focusMode"])}
                onChange={(e) => set("camera.dof.focusMode", e.target.value)}
              >
                <option>Manual distance</option>
                <option>Selected Entity</option>
                <option>Selected Entity's cluster</option>
                <option>Nearest rendered entity</option>
                <option>Largest visible cluster</option>
              </select>
            </label>
            <label>
              Focus distance
              <input
                type="number"
                value={Number(visualState.values["camera.dof.focusDistance"])}
                onChange={(e) =>
                  set("camera.dof.focusDistance", Number(e.target.value))
                }
              />
            </label>
            <label>
              Blur / bokeh
              <input
                type="number"
                value={Number(visualState.values["camera.dof.blurAmount"])}
                onChange={(e) =>
                  set("camera.dof.blurAmount", Number(e.target.value))
                }
              />
            </label>
            <label>
              Orbit speed
              <input
                type="number"
                value={Number(visualState.values["camera.autoRotateSpeed"])}
                onChange={(e) =>
                  set("camera.autoRotateSpeed", Number(e.target.value))
                }
              />
            </label>
            <label>
              Near clip
              <input
                type="number"
                value={Number(visualState.values["camera.near"])}
                onChange={(e) => set("camera.near", Number(e.target.value))}
              />
            </label>
            <label>
              Far clip
              <input
                type="number"
                value={Number(visualState.values["camera.far"])}
                onChange={(e) => set("camera.far", Number(e.target.value))}
              />
            </label>
            <button onClick={() => setCameraMenuOpen(false)}>Collapse</button>
          </div>
        )}
      </div>
    </>
  );
}

interface Environment {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  ambient: THREE.AmbientLight;
  primary: THREE.PointLight;
  fill: THREE.PointLight;
}
function applyEnvironment(
  { scene, camera, renderer, controls, ambient, primary, fill }: Environment,
  values: VisualConfiguration,
  palettes: readonly Palette[],
): void {
  const background = paletteColor(
    values,
    "Background",
    0,
    stringValue(values, "scene.background"),
    palettes,
  );
  scene.background = new THREE.Color(background);
  const fogType = booleanValue(values, "scene.fogEnabled")
    ? stringValue(values, "scene.fogType")
    : "none";
  const fogColor = paletteColor(
    values,
    "Environment",
    0.15,
    stringValue(values, "scene.fogColor"),
    palettes,
  );
  scene.fog =
    fogType === "exponential"
      ? new THREE.FogExp2(fogColor, numberValue(values, "scene.fogDensity"))
      : fogType === "linear"
        ? new THREE.Fog(
            fogColor,
            numberValue(values, "scene.fogNear"),
            numberValue(values, "scene.fogFar"),
          )
        : null;
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, numberValue(values, "scene.pixelRatioCap")),
  );
  renderer.toneMappingExposure = numberValue(values, "scene.exposure");
  renderer.toneMapping = (
    {
      none: THREE.NoToneMapping,
      linear: THREE.LinearToneMapping,
      reinhard: THREE.ReinhardToneMapping,
      aces: THREE.ACESFilmicToneMapping,
    } as const
  )[
    stringValue(values, "scene.toneMapping") as
      | "none"
      | "linear"
      | "reinhard"
      | "aces"
  ];
  camera.fov = numberValue(values, "camera.fov");
  camera.near = numberValue(values, "camera.near");
  camera.far = numberValue(values, "camera.far");
  camera.updateProjectionMatrix();
  applyOrbitConfiguration(controls, values);
  for (const [light, prefix] of [
    [ambient, "light.ambient"],
    [primary, "light.primary"],
    [fill, "light.fill"],
  ] as const) {
    light.visible = booleanValue(values, `${prefix}Enabled`);
    light.color.set(
      paletteChannelColor(
        values,
        "Environment",
        prefix,
        `${prefix}/color`,
        stringValue(values, `${prefix}Color`),
        palettes,
      ),
    );
    light.intensity = numberValue(values, `${prefix}Intensity`);
  }
  const pp = vectorValue(values, "light.primaryPosition"),
    fp = vectorValue(values, "light.fillPosition");
  primary.position.set(...pp);
  fill.position.set(...fp);
}

export function applyOrbitConfiguration(
  controls: Pick<
    OrbitControls,
    | "enableDamping"
    | "dampingFactor"
    | "rotateSpeed"
    | "panSpeed"
    | "zoomSpeed"
    | "autoRotate"
    | "autoRotateSpeed"
  >,
  values: VisualConfiguration,
): void {
  controls.enableDamping = booleanValue(values, "camera.damping");
  controls.dampingFactor = numberValue(values, "camera.dampingFactor");
  controls.rotateSpeed = numberValue(values, "camera.rotateSpeed");
  controls.panSpeed = numberValue(values, "camera.panSpeed");
  controls.zoomSpeed = numberValue(values, "camera.zoomSpeed");
  controls.autoRotate = booleanValue(values, "camera.autoRotate");
  controls.autoRotateSpeed = numberValue(values, "camera.autoRotateSpeed");
}

export function visualTargetCount(
  frame: NonNullable<ReturnType<typeof useObserverState>["frame"]>,
  target: string,
  hasSelectedEntity: boolean,
  eventCount: number,
): number {
  if (target === "Selected Entity") return hasSelectedEntity ? 1 : 0;
  if (target === "Entities") return frame.entities.length;
  if (target === "Clusters") return frame.clusters.length;
  if (target === "Contexts")
    return frame.entities.filter(
      ({ contextHash }) => contextHash !== "0".repeat(64),
    ).length;
  if (target === "Condensed Entities") return frame.condensationRecords.length;
  if (target === "Events") return eventCount;
  if (target === "Relationships") return frame.bonds.length;
  if (target === "Positive Bonds")
    return frame.bonds.filter(
      ({ classification }) => classification === "active-positive",
    ).length;
  if (target === "Repulsion")
    return frame.bonds.filter(
      ({ classification }) => classification === "active-repulsion",
    ).length;
  if (target === "Weak Bonds")
    return frame.bonds.filter(({ classification }) =>
      classification.startsWith("weak-"),
    ).length;
  return 0;
}
