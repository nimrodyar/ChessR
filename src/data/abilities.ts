import { inBounds, isHole, pieceAt } from '../core/board';
import type { AbilityDef, BoardMutation } from '../core/abilities';
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

  // --- Tradeoff relics: real value, real cost — Castlevania-style cursed-item design. ---

  pawnBloodFrenzy: {
    id: 'pawnBloodFrenzy',
    name: 'Blood Frenzy',
    description:
      'On capturing, the ground behind it shatters from the force of the strike — but the frenzy leaves it frozen solid for its next turn.',
    trigger: 'onCapture',
    pieceType: 'pawn',
    rarity: 'uncommon',
    className: 'Berserker',
    effect: ({ move, piece }) => {
      if (!move) return [];
      return [
        { type: 'destroyTile', pos: move.from },
        // +2, not +1: this fires during the pawn's own side's turn, which immediately
        // ticks frozen counters down by 1 at turn end, so +2 nets exactly one skipped turn.
        { type: 'freeze', pieceId: piece.id, turns: 2 },
      ];
    },
  },
  rookShackle: {
    id: 'rookShackle',
    name: 'Chains of the Damned',
    description:
      'On capturing, binds the nearest surviving enemy in chains (frozen 1 turn) — but the recoil binds this rook too.',
    trigger: 'onCapture',
    pieceType: 'rook',
    rarity: 'rare',
    className: 'Hunter',
    effect: ({ board, move, piece }) => {
      if (!move) return [];
      const mutations: BoardMutation[] = [];
      outer: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const pos = { x: move.to.x + dx, y: move.to.y + dy };
          if (!inBounds(pos)) continue;
          const occupant = pieceAt(board, pos);
          if (occupant && occupant.color !== piece.color) {
            mutations.push({ type: 'freeze', pieceId: occupant.id, turns: 1 });
            break outer;
          }
        }
      }
      // Self-freeze always applies, whether or not a nearby enemy was found — the chains recoil regardless.
      mutations.push({ type: 'freeze', pieceId: piece.id, turns: 2 });
      return mutations;
    },
  },
  kingIronVigil: {
    id: 'kingIronVigil',
    name: 'Iron Vigil',
    description:
      'Once per battle: a surge of wardstone magic mends every crumbled tile beside the king — but the toll freezes him solid for a turn.',
    trigger: 'activated',
    pieceType: 'king',
    rarity: 'legendary',
    className: 'Paladin',
    effect: ({ board, piece }) => {
      const mutations: BoardMutation[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const pos = { x: piece.pos.x + dx, y: piece.pos.y + dy };
          if (inBounds(pos) && isHole(board, pos)) mutations.push({ type: 'restoreTile', pos });
        }
      }
      mutations.push({ type: 'freeze', pieceId: piece.id, turns: 2 });
      return mutations;
    },
  },
};
