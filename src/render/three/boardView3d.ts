import * as THREE from 'three';
import { BOARD_SIZE, type Board, type TileState } from '../../core/board';
import type { Position } from '../../core/pieces';
import type { Scene3D } from './scene3d';

export interface HighlightTarget {
  pos: Position;
  isCapture: boolean;
}

const SELECT_COLOR = 0xffcf6b;
const LEGAL_COLOR = 0x8fd66b;
const LEGAL_CAPTURE_COLOR = 0xe0483f;
const DARK_TILE = 0x2a232b;
const PALE_TILE = 0x8d7a5c;
const HOLE_TILE = 0x08080c;

const selectGeo = new THREE.RingGeometry(0.32, 0.42, 32);
const legalGeo = new THREE.CircleGeometry(0.12, 24);
const captureGeo = new THREE.RingGeometry(0.28, 0.42, 32);
const selectMat = new THREE.MeshBasicMaterial({ color: SELECT_COLOR, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
const legalMat = new THREE.MeshBasicMaterial({ color: LEGAL_COLOR, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
const captureMat = new THREE.MeshBasicMaterial({ color: LEGAL_CAPTURE_COLOR, transparent: true, opacity: 0.55, side: THREE.DoubleSide });

export class BoardView3D {
  onTileClick: (pos: Position) => void = () => {};

  private tileStates: TileState[][];
  private markerGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private scene3d: Scene3D;

  constructor(scene3d: Scene3D) {
    this.scene3d = scene3d;
    scene3d.worldGroup.add(this.markerGroup);
    this.tileStates = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => 'normal' as TileState),
    );
    scene3d.renderer.domElement.addEventListener('pointerdown', (event) => this.handlePointer(event));
  }

  private handlePointer(event: PointerEvent): void {
    const rect = this.scene3d.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.scene3d.camera);
    const hits = this.raycaster.intersectObjects(this.scene3d.tileMeshes.flat(), false);
    if (hits.length === 0) return;
    const pos = hits[0].object.userData.boardPos as Position;
    this.onTileClick(pos);
  }

  drawTile(x: number, y: number, state: TileState): void {
    this.tileStates[y][x] = state;
    const tile = this.scene3d.tileMeshes[y][x];
    const mat = tile.material as THREE.MeshStandardMaterial;
    if (state === 'hole') {
      tile.position.y = -0.6;
      mat.color.set(HOLE_TILE);
      mat.emissive.set(0x330500);
      mat.emissiveIntensity = 0.5;
    } else {
      tile.position.y = -0.09;
      const isDark = (x + y) % 2 === 0;
      mat.color.set(isDark ? DARK_TILE : PALE_TILE);
      mat.emissiveIntensity = 0;
    }
  }

  syncBoard(board: Board): void {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        this.drawTile(x, y, board.tiles[y][x].state);
      }
    }
  }

  getTileMesh(pos: Position): THREE.Mesh {
    return this.scene3d.tileMeshes[pos.y][pos.x];
  }

  highlight(selected: Position | null, targets: HighlightTarget[]): void {
    this.markerGroup.clear();
    if (selected) {
      const mesh = new THREE.Mesh(selectGeo, selectMat);
      mesh.rotation.x = -Math.PI / 2;
      const tile = this.getTileMesh(selected);
      mesh.position.set(tile.position.x, 0.011, tile.position.z);
      this.markerGroup.add(mesh);
    }
    for (const target of targets) {
      const tile = this.getTileMesh(target.pos);
      const mesh = new THREE.Mesh(target.isCapture ? captureGeo : legalGeo, target.isCapture ? captureMat : legalMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(tile.position.x, 0.011, tile.position.z);
      this.markerGroup.add(mesh);
    }
  }
}
