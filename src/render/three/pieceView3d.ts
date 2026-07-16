import * as THREE from 'three';
import { buildPiece } from '../../demo3d/pieces';
import type { Piece, PieceType } from '../../core/pieces';
import { boardToWorld, type Scene3D } from './scene3d';

interface Entry {
  group: THREE.Group;
  halo?: THREE.Mesh;
  glowParts: THREE.Mesh[];
  color: 'white' | 'black';
  bobPhase: number;
  lift: number;
  animating: boolean;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

export class PieceView3D {
  private entries = new Map<string, Entry>();
  private scene3d: Scene3D;

  constructor(scene3d: Scene3D) {
    this.scene3d = scene3d;
  }

  syncPieces(pieces: Piece[]): void {
    const seen = new Set<string>();
    for (const piece of pieces) {
      seen.add(piece.id);
      let entry = this.entries.get(piece.id);
      if (!entry) {
        entry = this.createEntry(piece);
        this.entries.set(piece.id, entry);
      }
      if (!entry.animating) {
        const world = boardToWorld(piece.pos.x, piece.pos.y);
        entry.group.position.set(world.x, 0, world.z);
        entry.group.scale.set(1, 1, 1);
        entry.group.rotation.set(0, 0, 0);
        entry.group.visible = true;
      }
    }
    for (const [id, entry] of this.entries) {
      if (!seen.has(id)) {
        this.scene3d.pieceGroup.remove(entry.group);
        disposeGroup(entry.group);
        this.entries.delete(id);
      }
    }
  }

  private createEntry(piece: Piece): Entry {
    const { group, halo, glowParts } = buildPiece(piece.type, piece.color);
    group.traverse((obj) => {
      obj.userData.rootPieceId = piece.id;
    });
    this.scene3d.pieceGroup.add(group);
    return {
      group,
      halo,
      glowParts,
      color: piece.color,
      bobPhase: Math.random() * Math.PI * 2,
      lift: 0,
      animating: false,
    };
  }

  getGroup(pieceId: string): THREE.Group | undefined {
    return this.entries.get(pieceId)?.group;
  }

  setAnimating(pieceId: string, animating: boolean): void {
    const entry = this.entries.get(pieceId);
    if (entry) entry.animating = animating;
  }

  setType(pieceId: string, type: PieceType): void {
    const entry = this.entries.get(pieceId);
    if (!entry) return;
    const pos = entry.group.position.clone();
    this.scene3d.pieceGroup.remove(entry.group);
    disposeGroup(entry.group);
    const built = buildPiece(type, entry.color);
    built.group.position.copy(pos);
    built.group.traverse((obj) => {
      obj.userData.rootPieceId = pieceId;
    });
    this.scene3d.pieceGroup.add(built.group);
    entry.group = built.group;
    entry.halo = built.halo;
    entry.glowParts = built.glowParts;
  }

  removeGroup(pieceId: string): void {
    const entry = this.entries.get(pieceId);
    if (entry) {
      this.scene3d.pieceGroup.remove(entry.group);
      disposeGroup(entry.group);
      this.entries.delete(pieceId);
    }
  }

  tick(elapsed: number, selectedId: string | null): void {
    for (const [id, entry] of this.entries) {
      if (entry.animating) continue;
      const bob = Math.sin(elapsed * 1.6 + entry.bobPhase) * 0.02;
      const targetLift = id === selectedId ? 0.16 : 0;
      entry.lift += (targetLift - entry.lift) * 0.15;
      entry.group.position.y = entry.lift + bob;
      if (entry.halo) entry.halo.rotation.z = elapsed * 0.8;
    }
  }
}
