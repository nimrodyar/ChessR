import * as THREE from 'three';
import { buildPiece } from '../../demo3d/pieces';
import type { AbilityRarity } from '../../core/abilities';
import type { MutationId, Piece, PieceType } from '../../core/pieces';
import { ABILITIES } from '../../data/abilities';
import { boardToWorld, type Scene3D } from './scene3d';

interface Entry {
  group: THREE.Group;
  halo?: THREE.Mesh;
  glowParts: THREE.Mesh[];
  color: 'white' | 'black';
  bobPhase: number;
  lift: number;
  animating: boolean;
  mutationGroup: THREE.Group;
  mutationIds: MutationId[];
  frozenShell?: THREE.Mesh;
}

const RARITY_GEM_COLORS: Record<AbilityRarity, { color: number; emissive: number }> = {
  common: { color: 0xc9a876, emissive: 0x6b4f22 },
  uncommon: { color: 0x7fdb82, emissive: 0x1f5722 },
  rare: { color: 0x8fc3f2, emissive: 0x1f3f6b },
  legendary: { color: 0xffcf6b, emissive: 0x6b4a1a },
};

/** Small rarity-colored gems orbiting the piece so its granted perks read at a glance on the board. */
function buildMutationGems(mutationIds: MutationId[]): THREE.Group {
  const group = new THREE.Group();
  const radius = 0.27;
  const y = 0.34;
  mutationIds.forEach((id, i) => {
    const def = ABILITIES[id];
    const palette = RARITY_GEM_COLORS[def.rarity];
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.045, 0),
      new THREE.MeshStandardMaterial({
        color: palette.color,
        emissive: palette.emissive,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.6,
      }),
    );
    const angle = (i / Math.max(mutationIds.length, 1)) * Math.PI * 2;
    gem.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    gem.castShadow = true;
    group.add(gem);
  });
  return group;
}

function buildFrozenShell(): THREE.Mesh {
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.4, 1),
    new THREE.MeshStandardMaterial({
      color: 0xbfe8ff,
      emissive: 0x6fd0ff,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.28,
      roughness: 0.1,
      metalness: 0,
      wireframe: true,
    }),
  );
  shell.position.y = 0.42;
  return shell;
}

function sameMutations(a: MutationId[], b: MutationId[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
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
      if (!sameMutations(entry.mutationIds, piece.mutations)) {
        this.refreshMutationGems(entry, piece.mutations);
      }
      this.setFrozenVisual(entry, (piece.frozenTurns ?? 0) > 0);
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
    const mutationGroup = buildMutationGems(piece.mutations);
    group.add(mutationGroup);
    this.scene3d.pieceGroup.add(group);
    return {
      group,
      halo,
      glowParts,
      color: piece.color,
      bobPhase: Math.random() * Math.PI * 2,
      lift: 0,
      animating: false,
      mutationGroup,
      mutationIds: [...piece.mutations],
    };
  }

  private refreshMutationGems(entry: Entry, mutationIds: MutationId[]): void {
    entry.group.remove(entry.mutationGroup);
    disposeGroup(entry.mutationGroup);
    entry.mutationGroup = buildMutationGems(mutationIds);
    entry.group.add(entry.mutationGroup);
    entry.mutationIds = [...mutationIds];
  }

  private setFrozenVisual(entry: Entry, frozen: boolean): void {
    if (frozen && !entry.frozenShell) {
      entry.frozenShell = buildFrozenShell();
      entry.group.add(entry.frozenShell);
    } else if (!frozen && entry.frozenShell) {
      entry.group.remove(entry.frozenShell);
      entry.frozenShell.geometry.dispose();
      (entry.frozenShell.material as THREE.Material).dispose();
      entry.frozenShell = undefined;
    }
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
    const wasFrozen = !!entry.frozenShell;
    this.scene3d.pieceGroup.remove(entry.group);
    disposeGroup(entry.group);
    const built = buildPiece(type, entry.color);
    built.group.position.copy(pos);
    built.group.traverse((obj) => {
      obj.userData.rootPieceId = pieceId;
    });
    const mutationGroup = buildMutationGems(entry.mutationIds);
    built.group.add(mutationGroup);
    this.scene3d.pieceGroup.add(built.group);
    entry.group = built.group;
    entry.halo = built.halo;
    entry.glowParts = built.glowParts;
    entry.mutationGroup = mutationGroup;
    entry.frozenShell = undefined;
    if (wasFrozen) {
      entry.frozenShell = buildFrozenShell();
      entry.group.add(entry.frozenShell);
    }
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
      // Bias the bob so it only ever lifts the piece up off the tile, never sinks it
      // below rest — otherwise the base clips into the "hard" tile geometry at the low point.
      const bob = (Math.sin(elapsed * 1.6 + entry.bobPhase) * 0.5 + 0.5) * 0.035;
      const targetLift = id === selectedId ? 0.16 : 0;
      entry.lift += (targetLift - entry.lift) * 0.15;
      entry.group.position.y = entry.lift + bob;
      if (entry.halo) entry.halo.rotation.z = elapsed * 0.8;
    }
  }
}
