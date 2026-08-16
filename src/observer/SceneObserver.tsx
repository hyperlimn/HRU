import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useObserverState } from './observer-state';
import { ThreeObservationRenderer } from './three/renderer-adapter';

export function SceneObserver() {
  const host = useRef<HTMLDivElement>(null); const adapter = useRef<ThreeObservationRenderer | undefined>(undefined);
  const { frame, visualEvents, channels, selectedHash, select } = useObserverState();
  useEffect(() => { if (frame) adapter.current?.update(frame, visualEvents); }, [frame, visualEvents]);
  useEffect(() => adapter.current?.setChannels(channels), [channels]);
  useEffect(() => adapter.current?.setSelection(selectedHash), [selectedHash]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07090f); scene.fog = new THREE.FogExp2(0x07090f, 0.025);
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200); camera.position.set(16, 12, 22);
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; scene.add(new THREE.AmbientLight(0x6688aa, 1.3), new THREE.PointLight(0x8bd9ff, 45));
    const observation = new ThreeObservationRenderer(scene); adapter.current = observation; observation.setChannels(channels); if (frame) observation.update(frame, visualEvents);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let downX = 0; let downY = 0;
    const pointerDown = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY; };
    const pointerUp = (event: PointerEvent) => { if (Math.hypot(event.clientX-downX,event.clientY-downY)>4) return; const rect=renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1); raycaster.setFromCamera(pointer,camera); const hit=raycaster.intersectObjects([...observation.raycastTargets()],false)[0]; select(hit ? observation.selectedHash(hit) : undefined); };
    renderer.domElement.addEventListener('pointerdown', pointerDown); renderer.domElement.addEventListener('pointerup', pointerUp);
    let frameId=0, frames=0, fpsStarted=performance.now(); const render=()=>{frameId=requestAnimationFrame(render); controls.update(); observation.animate(performance.now()); renderer.render(scene,camera); frames+=1; const now=performance.now(); if(now-fpsStarted>=500){window.dispatchEvent(new CustomEvent('hru:render-fps',{detail:frames*1000/(now-fpsStarted)}));frames=0;fpsStarted=now;}}; render();
    const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}; addEventListener('resize',resize);
    return()=>{cancelAnimationFrame(frameId);removeEventListener('resize',resize);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);controls.dispose();observation.dispose();renderer.dispose();element.removeChild(renderer.domElement);adapter.current=undefined;};
  }, []);
  return <div className="scene" ref={host} />;
}
