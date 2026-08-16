import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useObserverState } from './observer-state';
import { ThreeObservationRenderer } from './three/renderer-adapter';
import { useVisualLab } from '../visual-lab/visual-lab-context';
import { booleanValue, numberValue, stringValue, vectorValue, rendererTelemetry } from '../visual-lab/configuration';
import type { VisualConfiguration } from '../visual-lab/types';

export function SceneObserver() {
  const host = useRef<HTMLDivElement>(null); const adapter = useRef<ThreeObservationRenderer | undefined>(undefined);
  const { frame, visualEvents, channels, selectedHash, select } = useObserverState();
  const { state: visualState } = useVisualLab(); const environment = useRef<Parameters<typeof applyEnvironment>[0] | undefined>(undefined);
  useEffect(() => { if (frame) adapter.current?.update(frame, visualEvents); }, [frame, visualEvents]);
  useEffect(() => adapter.current?.setChannels(channels), [channels]);
  useEffect(() => adapter.current?.setSelection(selectedHash), [selectedHash]);
  useEffect(() => { if (visualState) { adapter.current?.setVisualConfiguration(visualState.values); if (environment.current) applyEnvironment(environment.current, visualState.values); } }, [visualState]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07090f); scene.fog = new THREE.FogExp2(0x07090f, 0.025);
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200); camera.position.set(16, 12, 22);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; const ambient=new THREE.AmbientLight(0x6688aa,1.3),primary=new THREE.PointLight(0x8bd9ff,45),fill=new THREE.PointLight(0x8b72ff,16);primary.position.set(7,12,9);fill.position.set(-10,-4,-6);scene.add(ambient,primary,fill);
    const observation = new ThreeObservationRenderer(scene); adapter.current = observation; environment.current={scene,camera,renderer,controls,ambient,primary,fill};if(visualState){observation.setVisualConfiguration(visualState.values);applyEnvironment(environment.current,visualState.values)} observation.setChannels(channels); if (frame) observation.update(frame, visualEvents);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let downX = 0; let downY = 0;
    const pointerDown = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY; };
    const pointerUp = (event: PointerEvent) => { if (Math.hypot(event.clientX-downX,event.clientY-downY)>4) return; const rect=renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1); raycaster.setFromCamera(pointer,camera); const hit=raycaster.intersectObjects([...observation.raycastTargets()],false)[0]; select(hit ? observation.selectedHash(hit) : undefined); };
    renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointerup', pointerUp);
    let frameId=0, frames=0, fpsStarted=performance.now(); const render=()=>{frameId=requestAnimationFrame(render); controls.update(); observation.animate(performance.now()); renderer.render(scene,camera); frames+=1; const now=performance.now(); if(now-fpsStarted>=500){const fps=frames*1000/(now-fpsStarted);window.dispatchEvent(new CustomEvent('hru:render-fps',{detail:fps}));window.dispatchEvent(new CustomEvent('hru:renderer-telemetry',{detail:{...rendererTelemetry(renderer,observation.raycastTargets().length,scene.getObjectByName('observation:positive-bonds')?.children.length??0),fps}}));frames=0;fpsStarted=now;}}; render();
    const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}; addEventListener('resize',resize);
    return()=>{cancelAnimationFrame(frameId);removeEventListener('resize',resize);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);controls.dispose();observation.dispose();renderer.dispose();element.removeChild(renderer.domElement);adapter.current=undefined;environment.current=undefined;};
  }, []);
  return <div className="scene" ref={host} />;
}

interface Environment {scene:THREE.Scene;camera:THREE.PerspectiveCamera;renderer:THREE.WebGLRenderer;controls:OrbitControls;ambient:THREE.AmbientLight;primary:THREE.PointLight;fill:THREE.PointLight}
function applyEnvironment({scene,camera,renderer,controls,ambient,primary,fill}:Environment,values:VisualConfiguration):void{
  scene.background=new THREE.Color(stringValue(values,'scene.background'));const fogType=booleanValue(values,'scene.fogEnabled')?stringValue(values,'scene.fogType'):'none';scene.fog=fogType==='exponential'?new THREE.FogExp2(stringValue(values,'scene.fogColor'),numberValue(values,'scene.fogDensity')):fogType==='linear'?new THREE.Fog(stringValue(values,'scene.fogColor'),numberValue(values,'scene.fogNear'),numberValue(values,'scene.fogFar')):null;
  renderer.setPixelRatio(Math.min(devicePixelRatio,numberValue(values,'scene.pixelRatioCap')));renderer.toneMappingExposure=numberValue(values,'scene.exposure');renderer.toneMapping=({none:THREE.NoToneMapping,linear:THREE.LinearToneMapping,reinhard:THREE.ReinhardToneMapping,aces:THREE.ACESFilmicToneMapping} as const)[stringValue(values,'scene.toneMapping') as 'none'|'linear'|'reinhard'|'aces'];
  camera.fov=numberValue(values,'camera.fov');camera.near=numberValue(values,'camera.near');camera.far=numberValue(values,'camera.far');camera.updateProjectionMatrix();
  controls.enableDamping=booleanValue(values,'camera.damping');controls.dampingFactor=numberValue(values,'camera.dampingFactor');controls.rotateSpeed=numberValue(values,'camera.rotateSpeed');controls.panSpeed=numberValue(values,'camera.panSpeed');controls.zoomSpeed=numberValue(values,'camera.zoomSpeed');controls.autoRotate=booleanValue(values,'camera.autoRotate');controls.autoRotateSpeed=numberValue(values,'camera.autoRotateSpeed');
  for(const [light,prefix] of [[ambient,'light.ambient'],[primary,'light.primary'],[fill,'light.fill']] as const){light.visible=booleanValue(values,`${prefix}Enabled`);light.color.set(stringValue(values,`${prefix}Color`));light.intensity=numberValue(values,`${prefix}Intensity`)}
  const pp=vectorValue(values,'light.primaryPosition'),fp=vectorValue(values,'light.fillPosition');primary.position.set(...pp);fill.position.set(...fp);
}
