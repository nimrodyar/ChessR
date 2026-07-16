import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { BOARD_SIZE } from '../../core/board';

const BOARD_OFFSET = (BOARD_SIZE - 1) / 2;

export interface Scene3D {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  worldGroup: THREE.Group;
  boardGroup: THREE.Group;
  pieceGroup: THREE.Group;
  tileMeshes: THREE.Mesh[][];
  candle: THREE.PointLight;
  emberGeo: THREE.BufferGeometry;
  emberSpeeds: Float32Array;
  emberCount: number;
}

export function boardToWorld(x: number, y: number): { x: number; z: number } {
  return { x: x - BOARD_OFFSET, z: y - BOARD_OFFSET };
}

export function makeSpriteTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,210,140,1)');
  gradient.addColorStop(0.4, 'rgba(255,160,80,0.7)');
  gradient.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const spriteTexture = makeSpriteTexture();

export function createScene3D(container: HTMLElement): Scene3D {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030203, 0.03);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0.5, 6.6, 7.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.3, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 4;
  controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.47;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  scene.add(new THREE.AmbientLight(0x3a3048, 0.9));

  const candle = new THREE.PointLight(0xffa554, 3.2, 14, 2);
  candle.position.set(-1.4, 3.2, 1.6);
  candle.castShadow = true;
  candle.shadow.mapSize.set(1024, 1024);
  candle.shadow.bias = -0.003;
  scene.add(candle);

  const rim = new THREE.DirectionalLight(0x6f7bcf, 0.7);
  rim.position.set(3, 4, -4);
  scene.add(rim);

  const fill = new THREE.HemisphereLight(0x463c5e, 0x14101a, 0.6);
  scene.add(fill);

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const boardGroup = new THREE.Group();
  worldGroup.add(boardGroup);

  const pieceGroup = new THREE.Group();
  worldGroup.add(pieceGroup);

  const darkStone = new THREE.MeshStandardMaterial({ color: 0x2a232b, roughness: 0.75, metalness: 0.05 });
  const paleStone = new THREE.MeshStandardMaterial({ color: 0x8d7a5c, roughness: 0.7, metalness: 0.05 });
  const goldTrim = new THREE.MeshStandardMaterial({
    color: 0xc9a227,
    roughness: 0.3,
    metalness: 0.85,
    emissive: 0x3a2500,
    emissiveIntensity: 0.5,
  });

  const tileMeshes: THREE.Mesh[][] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    const row: THREE.Mesh[] = [];
    for (let x = 0; x < BOARD_SIZE; x++) {
      const isDark = (x + y) % 2 === 0;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.18, 0.97), (isDark ? darkStone : paleStone).clone());
      const world = boardToWorld(x, y);
      tile.position.set(world.x, -0.09, world.z);
      tile.receiveShadow = true;
      tile.userData.boardPos = { x, y };
      boardGroup.add(tile);
      row.push(tile);
    }
    tileMeshes.push(row);
  }

  const frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD_SIZE + 0.5, 0.28, BOARD_SIZE + 0.5), goldTrim);
  frame.position.y = -0.22;
  frame.receiveShadow = true;
  boardGroup.add(frame);

  const emberCount = 140;
  const emberGeo = new THREE.BufferGeometry();
  const emberPositions = new Float32Array(emberCount * 3);
  const emberSpeeds = new Float32Array(emberCount);
  for (let i = 0; i < emberCount; i++) {
    emberPositions[i * 3] = (Math.random() - 0.5) * 9;
    emberPositions[i * 3 + 1] = Math.random() * 4;
    emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 9;
    emberSpeeds[i] = 0.15 + Math.random() * 0.35;
  }
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const emberMat = new THREE.PointsMaterial({
    size: 0.06,
    map: spriteTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xffb066,
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  scene.add(embers);

  return {
    scene,
    camera,
    renderer,
    controls,
    worldGroup,
    boardGroup,
    pieceGroup,
    tileMeshes,
    candle,
    emberGeo,
    emberSpeeds,
    emberCount,
  };
}

export function tickAmbient(scene3d: Scene3D, elapsed: number): void {
  scene3d.candle.intensity = 3.0 + Math.sin(elapsed * 8) * 0.15 + Math.sin(elapsed * 23) * 0.08;

  const positions = scene3d.emberGeo.attributes.position.array as Float32Array;
  for (let i = 0; i < scene3d.emberCount; i++) {
    positions[i * 3 + 1] += scene3d.emberSpeeds[i] * 0.01;
    if (positions[i * 3 + 1] > 4.2) positions[i * 3 + 1] = 0;
  }
  scene3d.emberGeo.attributes.position.needsUpdate = true;

  scene3d.controls.update();
  scene3d.renderer.render(scene3d.scene, scene3d.camera);
}

export function burstParticlesAt(scene3d: Scene3D, position: THREE.Vector3, color: number): void {
  const count = 60;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
    velocities.push(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2.2 + 0.4, (Math.random() - 0.5) * 2));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.09,
    map: spriteTexture,
    color,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene3d.worldGroup.add(points);

  const state = { t: 0 };
  gsap.to(state, {
    t: 1,
    duration: 1.1,
    ease: 'power1.out',
    onUpdate: () => {
      const arr = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] = position.x + velocities[i].x * state.t;
        arr[i * 3 + 1] = position.y + velocities[i].y * state.t - 2 * state.t * state.t;
        arr[i * 3 + 2] = position.z + velocities[i].z * state.t;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - state.t;
    },
    onComplete: () => {
      scene3d.worldGroup.remove(points);
      geo.dispose();
      mat.dispose();
    },
  });
}

export function shakeWorld(scene3d: Scene3D, intensity: number, duration: number): void {
  const originX = scene3d.worldGroup.position.x;
  gsap.to(scene3d.worldGroup.position, {
    x: originX + intensity,
    duration: duration / 6,
    yoyo: true,
    repeat: 5,
    onComplete: () => {
      scene3d.worldGroup.position.x = originX;
    },
  });
}
