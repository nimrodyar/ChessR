import gsap from 'gsap';
import * as THREE from 'three';
import type { AnimationStep } from '../../core/combat';
import type { PieceView3D } from './pieceView3d';
import type { BoardView3D } from './boardView3d';
import { boardToWorld, burstParticlesAt, shakeWorld, type Scene3D } from './scene3d';

const MOVE_DURATION = 0.28;
const FADE_DURATION = 0.4;
const SUNDER_DURATION = 0.4;

export async function playAnimations(
  steps: AnimationStep[],
  pieceView: PieceView3D,
  boardView: BoardView3D,
  scene3d: Scene3D,
): Promise<void> {
  for (const step of steps) {
    await playStep(step, pieceView, boardView, scene3d);
  }
}

function playStep(step: AnimationStep, pieceView: PieceView3D, boardView: BoardView3D, scene3d: Scene3D): Promise<void> {
  return new Promise((resolve) => {
    switch (step.type) {
      case 'move': {
        const group = step.pieceId ? pieceView.getGroup(step.pieceId) : undefined;
        if (!group || !step.to || !step.pieceId) return resolve();
        const pieceId = step.pieceId;
        const world = boardToWorld(step.to.x, step.to.y);
        pieceView.setAnimating(pieceId, true);
        gsap.to(group.position, {
          x: world.x,
          z: world.z,
          duration: MOVE_DURATION,
          ease: 'power2.out',
          onComplete: () => {
            pieceView.setAnimating(pieceId, false);
            resolve();
          },
        });
        return;
      }
      case 'capture': {
        const group = step.pieceId ? pieceView.getGroup(step.pieceId) : undefined;
        if (!group || !step.pieceId) return resolve();
        const pieceId = step.pieceId;
        pieceView.setAnimating(pieceId, true);
        burstParticlesAt(scene3d, new THREE.Vector3(group.position.x, 0.35, group.position.z), 0xffcf6b);
        gsap
          .timeline({
            onComplete: () => {
              pieceView.removeGroup(pieceId);
              resolve();
            },
          })
          .to(group.scale, { x: 0.15, y: 0.05, z: 0.15, duration: FADE_DURATION, ease: 'power2.in' })
          .to(group.position, { y: -0.5, duration: FADE_DURATION, ease: 'power2.in' }, '<');
        return;
      }
      case 'fallThrough': {
        const group = step.pieceId ? pieceView.getGroup(step.pieceId) : undefined;
        if (!group || !step.pieceId) return resolve();
        const pieceId = step.pieceId;
        pieceView.setAnimating(pieceId, true);
        burstParticlesAt(scene3d, new THREE.Vector3(group.position.x, 0.1, group.position.z), 0xff5522);
        gsap
          .timeline({
            onComplete: () => {
              pieceView.removeGroup(pieceId);
              resolve();
            },
          })
          .to(group.position, { y: -1.6, duration: FADE_DURATION, ease: 'power2.in' })
          .to(group.rotation, { x: Math.PI * 0.4, z: Math.PI * 0.3, duration: FADE_DURATION, ease: 'power2.in' }, '<')
          .to(group.scale, { x: 0.3, y: 0.3, z: 0.3, duration: FADE_DURATION, ease: 'power2.in' }, '<');
        return;
      }
      case 'destroyTile': {
        if (!step.pos) return resolve();
        const tile = boardView.getTileMesh(step.pos);
        shakeWorld(scene3d, 0.08, 0.4);
        const crack = new THREE.Mesh(
          new THREE.PlaneGeometry(0.94, 0.94),
          new THREE.MeshStandardMaterial({ color: 0x2a0000, emissive: 0xff2200, emissiveIntensity: 0, roughness: 0.9 }),
        );
        crack.rotation.x = -Math.PI / 2;
        crack.position.set(tile.position.x, -0.24, tile.position.z);
        scene3d.boardGroup.add(crack);
        burstParticlesAt(scene3d, new THREE.Vector3(tile.position.x, 0.05, tile.position.z), 0xff5522);
        gsap
          .timeline({
            onComplete: () => {
              boardView.drawTile(step.pos!.x, step.pos!.y, 'hole');
              gsap.to(crack.material as THREE.MeshStandardMaterial, {
                emissiveIntensity: 0.6,
                duration: 0.6,
              });
              resolve();
            },
          })
          .to(tile.position, { y: -0.6, duration: SUNDER_DURATION, ease: 'power2.in' })
          .to(crack.material as THREE.MeshStandardMaterial, { emissiveIntensity: 1.8, duration: SUNDER_DURATION * 0.7 }, '<');
        return;
      }
      case 'restoreTile': {
        if (!step.pos) return resolve();
        const tile = boardView.getTileMesh(step.pos);
        burstParticlesAt(scene3d, new THREE.Vector3(tile.position.x, 0.05, tile.position.z), 0x9fe6a0);
        gsap
          .timeline({
            onComplete: () => {
              boardView.drawTile(step.pos!.x, step.pos!.y, 'normal');
              resolve();
            },
          })
          .to(tile.position, { y: -0.09, duration: SUNDER_DURATION, ease: 'power2.out' });
        return;
      }
      case 'promote': {
        if (step.pieceId && step.promotedType) pieceView.setType(step.pieceId, step.promotedType);
        const group = step.pieceId ? pieceView.getGroup(step.pieceId) : undefined;
        if (!group) return resolve();
        gsap
          .timeline({ onComplete: resolve })
          .to(group.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 0.15 })
          .to(group.scale, { x: 1, y: 1, z: 1, duration: 0.15 });
        return;
      }
      default:
        resolve();
    }
  });
}
