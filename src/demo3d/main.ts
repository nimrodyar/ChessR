import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import { buildPiece, type DemoColor, type DemoPieceType } from './pieces';

const appEl = document.querySelector<HTMLDivElement>('#app');
if (!appEl) throw new Error('#app root element missing');

const hud = document.createElement('div');
hud.className = 'demo-hud';
hud.innerHTML = `
  <div class="demo-title">
    <h1>Chess Rogue</h1>
    <p>— a board consecrated in guilt —</p>
  </div>
  <div class="demo-hint">click a piece to rouse it &nbsp;·&nbsp; drag to gaze upon the altar</div>
  <div class="demo-controls">
    <button class="demo-button" id="btn-capture">Preview Capture</button>
    <button class="demo-button" id="btn-sunder">Preview Ground Sunder</button>
    <button class="demo-button" id="btn-rotate">Toggle Camera Drift</button>
  </div>
`;
appEl.appendChild(hud);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030203, 0.055);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0.5, 6.6, 7.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
appEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.3, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.47;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Lighting: chiaroscuro candlelight ----------
scene.add(new THREE.AmbientLight(0x2a2035, 0.55));

const candle = new THREE.PointLight(0xffa554, 3.2, 14, 2);
candle.position.set(-1.4, 3.2, 1.6);
candle.castShadow = true;
candle.shadow.mapSize.set(1024, 1024);
candle.shadow.bias = -0.003;
scene.add(candle);

const rim = new THREE.DirectionalLight(0x6f7bcf, 0.55);
rim.position.set(3, 4, -4);
scene.add(rim);

const fill = new THREE.HemisphereLight(0x342c4a, 0x0a0608, 0.35);
scene.add(fill);

// ---------- Board ----------
const TILE = 1;
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const darkStone = new THREE.MeshStandardMaterial({ color: 0x120d10, roughness: 0.75, metalness: 0.05 });
const paleStone = new THREE.MeshStandardMaterial({ color: 0x8d7a5c, roughness: 0.7, metalness: 0.05 });
const goldTrim = new THREE.MeshStandardMaterial({
  color: 0xc9a227,
  roughness: 0.3,
  metalness: 0.85,
  emissive: 0x3a2500,
  emissiveIntensity: 0.5,
});

const tileMeshes: THREE.Mesh[][] = [];
for (let row = 0; row < 8; row++) {
  const rowMeshes: THREE.Mesh[] = [];
  for (let col = 0; col < 8; col++) {
    const isDark = (row + col) % 2 === 0;
    const tile = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.97, 0.18, TILE * 0.97), isDark ? darkStone : paleStone);
    tile.position.set(col - 3.5, -0.09, row - 3.5);
    tile.receiveShadow = true;
    tile.castShadow = false;
    boardGroup.add(tile);
    rowMeshes.push(tile);
  }
  tileMeshes.push(rowMeshes);
}

const frame = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.28, 8.5), goldTrim);
frame.position.y = -0.22;
frame.receiveShadow = true;
boardGroup.add(frame);

const crackGeo = new THREE.PlaneGeometry(0.94, 0.94);
const crackMat = new THREE.MeshStandardMaterial({
  color: 0x2a0000,
  emissive: 0xff2200,
  emissiveIntensity: 0,
  roughness: 0.9,
});

// ---------- Ash / ember particles ----------
function makeSpriteTexture(): THREE.Texture {
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
  map: makeSpriteTexture(),
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  color: 0xffb066,
});
const embers = new THREE.Points(emberGeo, emberMat);
scene.add(embers);

// ---------- Pieces ----------
const BACK_RANK: DemoPieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

interface PlacedPiece {
  group: THREE.Group;
  halo?: THREE.Mesh;
  glowParts: THREE.Mesh[];
  baseY: number;
  bobPhase: number;
  selected: boolean;
}

const placedPieces: PlacedPiece[] = [];

function placePiece(type: DemoPieceType, color: DemoColor, col: number, row: number): void {
  const { group, halo, glowParts } = buildPiece(type, color);
  group.position.set(col - 3.5, 0, row - 3.5);
  group.traverse((obj) => {
    obj.userData.rootPiece = group;
  });
  scene.add(group);
  placedPieces.push({ group, halo, glowParts, baseY: 0, bobPhase: Math.random() * Math.PI * 2, selected: false });
}

BACK_RANK.forEach((type, col) => {
  placePiece(type, 'black', col, 0);
  placePiece(type, 'white', col, 7);
});
for (let col = 0; col < 8; col++) {
  placePiece('pawn', 'black', col, 1);
  placePiece('pawn', 'white', col, 6);
}

// ---------- Selection interaction ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let currentSelection: PlacedPiece | null = null;

function setSelected(piece: PlacedPiece | null): void {
  if (currentSelection === piece) return;
  if (currentSelection) {
    const prev = currentSelection;
    prev.selected = false;
    gsap.killTweensOf(prev.group.position);
    gsap.to(prev.group.position, { y: 0, duration: 0.35, ease: 'power2.out' });
    prev.glowParts.forEach((mesh) => {
      gsap.killTweensOf((mesh.material as THREE.MeshStandardMaterial));
      gsap.to(mesh.material as THREE.MeshStandardMaterial, { emissiveIntensity: 0.5, duration: 0.4 });
    });
  }
  currentSelection = piece;
  if (piece) {
    piece.selected = true;
    gsap.to(piece.group.position, { y: 0.16, duration: 0.4, ease: 'back.out(2)' });
    piece.glowParts.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      gsap.to(mat, {
        emissiveIntensity: 2.2,
        duration: 0.55,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });
  }
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  const hit = hits.find((h) => h.object.userData.rootPiece);
  if (!hit) {
    setSelected(null);
    return;
  }
  const rootGroup = hit.object.userData.rootPiece as THREE.Group;
  const piece = placedPieces.find((p) => p.group === rootGroup) ?? null;
  setSelected(currentSelection === piece ? null : piece);
});

// ---------- Capture VFX demo ----------
function burstParticlesAt(position: THREE.Vector3, color: number): void {
  const count = 60;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y + 0.3;
    positions[i * 3 + 2] = position.z;
    velocities.push(
      new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2.2 + 0.4, (Math.random() - 0.5) * 2),
    );
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.09,
    map: makeSpriteTexture(),
    color,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  const state = { t: 0 };
  gsap.to(state, {
    t: 1,
    duration: 1.1,
    ease: 'power1.out',
    onUpdate: () => {
      const arr = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] = position.x + velocities[i].x * state.t;
        arr[i * 3 + 1] = position.y + 0.3 + velocities[i].y * state.t - 2 * state.t * state.t;
        arr[i * 3 + 2] = position.z + velocities[i].z * state.t;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - state.t;
    },
    onComplete: () => {
      scene.remove(points);
      geo.dispose();
      mat.dispose();
    },
  });
}

function shakeCamera(intensity: number, duration: number): void {
  const origin = camera.position.clone();
  const state = { t: 0 };
  gsap.to(state, {
    t: 1,
    duration,
    onUpdate: () => {
      camera.position.x = origin.x + (Math.random() - 0.5) * intensity;
      camera.position.y = origin.y + (Math.random() - 0.5) * intensity;
    },
    onComplete: () => camera.position.copy(origin),
  });
}

let captureTarget: PlacedPiece | null = placedPieces.find((p) => p.group.position.z === 1 - 3.5) ?? null;
document.querySelector('#btn-capture')!.addEventListener('click', () => {
  const piece = captureTarget;
  if (!piece || piece.selected) return;
  const pos = piece.group.position.clone();
  burstParticlesAt(pos, 0xffcf6b);
  gsap.timeline().to(piece.group.scale, { x: 0.2, y: 0.1, z: 0.2, duration: 0.5, ease: 'power2.in' }).to(
    piece.group.position,
    { y: -0.5, duration: 0.5, ease: 'power2.in' },
    '<',
  );
  gsap.to(piece.group, {
    duration: 0.5,
    onComplete: () => {
      piece.group.visible = false;
      gsap.delayedCall(1.4, () => {
        piece.group.visible = true;
        piece.group.scale.set(1, 1, 1);
        piece.group.position.set(pos.x, 0, pos.z);
      });
    },
  });
});

// ---------- Ground Sunder VFX demo (queenEarthquake callback) ----------
document.querySelector('#btn-sunder')!.addEventListener('click', () => {
  const centerCol = 4;
  const centerRow = 3;
  shakeCamera(0.12, 0.5);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const row = centerRow + dr;
      const col = centerCol + dc;
      if (row < 0 || row > 7 || col < 0 || col > 7) continue;
      const tile = tileMeshes[row][col];
      const crack = new THREE.Mesh(crackGeo, crackMat.clone());
      crack.rotation.x = -Math.PI / 2;
      crack.position.set(tile.position.x, -0.24, tile.position.z);
      boardGroup.add(crack);
      gsap.to(tile.position, { y: -0.6, duration: 0.4, ease: 'power2.in' });
      gsap.to((crack.material as THREE.MeshStandardMaterial), { emissiveIntensity: 2.5, duration: 0.3 });
      burstParticlesAt(new THREE.Vector3(tile.position.x, 0, tile.position.z), 0xff5522);
      gsap.delayedCall(2, () => {
        gsap.to(tile.position, { y: -0.09, duration: 0.6, ease: 'power2.out' });
        gsap.to((crack.material as THREE.MeshStandardMaterial), {
          emissiveIntensity: 0,
          duration: 0.6,
          onComplete: () => {
            boardGroup.remove(crack);
            crack.geometry.dispose();
            (crack.material as THREE.Material).dispose();
          },
        });
      });
    }
  }
});

document.querySelector('#btn-rotate')!.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
});

// ---------- Animation loop ----------
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  candle.intensity = 3.0 + Math.sin(t * 8) * 0.15 + Math.sin(t * 23) * 0.08;

  for (const piece of placedPieces) {
    if (!piece.group.visible) continue;
    const bob = Math.sin(t * 1.6 + piece.bobPhase) * 0.02;
    piece.group.position.y = (piece.selected ? 0.16 : 0) + bob;
    if (piece.halo) {
      piece.halo.rotation.z = t * 0.8;
    }
  }

  const positions = emberGeo.attributes.position.array as Float32Array;
  for (let i = 0; i < emberCount; i++) {
    positions[i * 3 + 1] += emberSpeeds[i] * 0.01;
    if (positions[i * 3 + 1] > 4.2) {
      positions[i * 3 + 1] = 0;
    }
  }
  emberGeo.attributes.position.needsUpdate = true;

  controls.update();
  renderer.render(scene, camera);
}

animate();
