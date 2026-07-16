import { inBounds, isHole } from '../core/board';
import type { AbilityDef } from '../core/abilities';
import type { MutationId } from '../core/pieces';

export const ABILITIES: Record<MutationId, AbilityDef> = {
  pawnLandmine: {
    id: 'pawnLandmine',
    name: 'Landmine',
    description: 'On death, destroys the tile it was standing on.',
    trigger: 'onDeath',
    pieceType: 'pawn',
    rarity: 'common',
    className: 'Barbarian',
    effect: ({ piece }) => [{ type: 'destroyTile', pos: piece.pos }],
  },
  pawnZealot: {
    id: 'pawnZealot',
    name: "Zealot's Last Stand",
    description: 'On death, sanctifies its ground in a holy blast, destroying the tiles to its north, south, east and west.',
    trigger: 'onDeath',
    pieceType: 'pawn',
    rarity: 'rare',
    className: 'Paladin',
    effect: ({ piece }) => {
      const offsets = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ];
      return offsets
        .map(([dx, dy]) => ({ x: piece.pos.x + dx, y: piece.pos.y + dy }))
        .filter(inBounds)
        .map((pos) => ({ type: 'destroyTile' as const, pos }));
    },
  },
  knightCharge: {
    id: 'knightCharge',
    name: 'Charge',
    description: 'On capturing, destroys the corner tile it hopped over.',
    trigger: 'onCapture',
    pieceType: 'knight',
    rarity: 'common',
    className: 'Barbarian',
    effect: ({ move }) => {
      if (!move) return [];
      const dx = Math.abs(move.to.x - move.from.x);
      // the L-corner: same row as the longer axis of travel
      const corner =
        dx === 2 ? { x: move.to.x, y: move.from.y } : { x: move.from.x, y: move.to.y };
      return [{ type: 'destroyTile', pos: corner }];
    },
  },
  knightShadowStep: {
    id: 'knightShadowStep',
    name: 'Shadow Step',
    description: 'On capturing, the ground it vanished from crumbles into a hole.',
    trigger: 'onCapture',
    pieceType: 'knight',
    rarity: 'uncommon',
    className: 'Rogue',
    effect: ({ move }) => {
      if (!move) return [];
      return [{ type: 'destroyTile', pos: move.from }];
    },
  },
  bishopArsonist: {
    id: 'bishopArsonist',
    name: 'Arsonist',
    description: 'On capturing, sets the tile diagonally beyond the kill ablaze.',
    trigger: 'onCapture',
    pieceType: 'bishop',
    rarity: 'common',
    className: 'Warlock',
    effect: ({ move }) => {
      if (!move) return [];
      const dx = Math.sign(move.to.x - move.from.x);
      const dy = Math.sign(move.to.y - move.from.y);
      const target = { x: move.to.x + dx, y: move.to.y + dy };
      if (!inBounds(target)) return [];
      return [{ type: 'destroyTile', pos: target }];
    },
  },
  bishopWard: {
    id: 'bishopWard',
    name: 'Sanctify Ground',
    description: 'Once per battle: mends a crumbled tile adjacent to it back to solid stone.',
    trigger: 'activated',
    pieceType: 'bishop',
    rarity: 'uncommon',
    className: 'Cleric',
    effect: ({ board, piece }) => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const pos = { x: piece.pos.x + dx, y: piece.pos.y + dy };
          if (inBounds(pos) && isHole(board, pos)) {
            return [{ type: 'restoreTile', pos }];
          }
        }
      }
      return [];
    },
  },
  rookDemolisher: {
    id: 'rookDemolisher',
    name: 'Demolisher',
    description: 'On capturing, destroys the tile just beyond the captured piece.',
    trigger: 'onCapture',
    pieceType: 'rook',
    rarity: 'common',
    className: 'Fighter',
    effect: ({ move }) => {
      if (!move) return [];
      const dx = Math.sign(move.to.x - move.from.x);
      const dy = Math.sign(move.to.y - move.from.y);
      const target = { x: move.to.x + dx, y: move.to.y + dy };
      if (!inBounds(target)) return [];
      return [{ type: 'destroyTile', pos: target }];
    },
  },
  rookSiegeEngine: {
    id: 'rookSiegeEngine',
    name: 'Siege Engine',
    description: 'On capturing, the destruction rolls two tiles past the captured piece instead of one.',
    trigger: 'onCapture',
    pieceType: 'rook',
    rarity: 'rare',
    className: 'Fighter',
    effect: ({ move }) => {
      if (!move) return [];
      const dx = Math.sign(move.to.x - move.from.x);
      const dy = Math.sign(move.to.y - move.from.y);
      const mutations: { type: 'destroyTile'; pos: { x: number; y: number } }[] = [];
      for (const dist of [1, 2]) {
        const target = { x: move.to.x + dx * dist, y: move.to.y + dy * dist };
        if (inBounds(target)) mutations.push({ type: 'destroyTile', pos: target });
      }
      return mutations;
    },
  },
  queenEarthquake: {
    id: 'queenEarthquake',
    name: 'Earthquake',
    description: 'Once per battle: destroys the 8 tiles surrounding the queen.',
    trigger: 'activated',
    pieceType: 'queen',
    rarity: 'rare',
    className: 'Wizard',
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
  queenCataclysm: {
    id: 'queenCataclysm',
    name: 'Cataclysm',
    description: 'Once per battle: unleashes a 5x5 ring of devastation centered on the queen.',
    trigger: 'activated',
    pieceType: 'queen',
    rarity: 'legendary',
    className: 'Wizard',
    effect: ({ piece }) => {
      const mutations: { type: 'destroyTile'; pos: { x: number; y: number } }[] = [];
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (dx === 0 && dy === 0) continue;
          const pos = { x: piece.pos.x + dx, y: piece.pos.y + dy };
          if (inBounds(pos)) mutations.push({ type: 'destroyTile', pos });
        }
      }
      return mutations;
    },
  },
  kingBunker: {
    id: 'kingBunker',
    name: 'Bunker',
    description: "The king's own tile can never be destroyed, by ally or enemy hand.",
    trigger: 'onDeath',
    pieceType: 'king',
    rarity: 'uncommon',
    className: 'Paladin',
    // Passive — enforced directly in combat.ts's processMutationQueue rather than fired as an event.
    effect: () => [],
  },
};
