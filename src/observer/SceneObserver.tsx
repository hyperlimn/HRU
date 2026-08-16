import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createDemoMarkers } from './demo/demo-markers';

export function SceneObserver() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090f);
    scene.fog = new THREE.FogExp2(0x07090f, 0.035);
    const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
    camera.position.set(5, 4, 8);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
    scene.add(new THREE.AmbientLight(0x6688aa, 1.4), new THREE.PointLight(0x8bd9ff, 35));
    scene.add(createDemoMarkers());
    const grid = new THREE.GridHelper(30, 30, 0x193345, 0x101923); grid.position.y = -3; scene.add(grid);
    let frame = 0; let frames = 0; let fpsStarted = performance.now();
    const render = () => {
      frame = requestAnimationFrame(render); controls.update(); renderer.render(scene, camera); frames += 1;
      const now = performance.now();
      if (now - fpsStarted >= 500) { window.dispatchEvent(new CustomEvent('hru:render-fps', { detail: frames * 1000 / (now - fpsStarted) })); frames = 0; fpsStarted = now; }
    };
    render();
    const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
    addEventListener('resize', resize);
    return () => { cancelAnimationFrame(frame); removeEventListener('resize', resize); controls.dispose(); renderer.dispose(); element.removeChild(renderer.domElement); };
  }, []);
  return <div className="scene" ref={host}><div className="demo-badge">DEVELOPMENT VISUALIZATION · NOT UNIVERSE ENTITIES</div></div>;
}
