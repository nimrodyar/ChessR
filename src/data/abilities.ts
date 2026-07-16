import { inBounds } from '../core/board';
import type { AbilityDef } from '../core/abilities';
import type { MutationId } from '../core/pieces';

export const ABILITIES: Record<MutationId, AbilityDef> = {
  pawnLandmine: {
    id: 'pawnLandmine',
    name: 'Landmine',
    description: 'On death, destroys the tile it was standing on.',
    trigger: 'onDeath',
    effect: ({ piece }) => [{ type: 'destroyTile', pos: piece.pos }],
  },
  knightCharge: {
    id: 'knightCharge',
    name: 'Charge',
    description: 'On capturing, destroys the corner tile it hopped over.',
    trigger: 'onCapture',
    effect: ({ move }) => {
      if (!move) return [];
      const dx = Math.abs(move.to.x - move.from.x);
      // the L-corner: same row as the longer axis of travel
      const corner =
        dx === 2 ? { x: move.to.x, y: move.from.y } : { x: move.from.x, y: move.to.y };
      return [{ type: 'destroyTile', pos: corner }];
    },
  },
  rookDemolisher: {
    id: 'rookDemolisher',
    name: 'Demolisher',
    description: 'On capturing, destroys the tile just beyond the captured piece.',
    trigger: 'onCapture',
    effect: ({ move }) => {
      if (!move) return [];
      const dx = Math.sign(move.to.x - move.from.x);
      const dy = Math.sign(move.to.y - move.from.y);
      const target = { x: move.to.x + dx, y: move.to.y + dy };
      if (!inBounds(target)) return [];
      return [{ type: 'destroyTile', pos: target }];
    },
  },
  queenEarthquake: {
    id: 'queenEarthquake',
    name: 'Earthquake',
    description: 'Once per battle: destroys the 8 tiles surrounding the queen.',
    trigger: 'activated',
    effect: ({ piece }) => {
      const mutations: { type: 'destroyTile'; pos: { x: number; y: number } }[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const pos = { x: piece.pos.x + dx, y: piece.pos.y + dy };
          if (inBounds(pos)) mutations.push({ type: 'destroyTile', pos });
        }
      }
      return mutations;
    },
  },
};
