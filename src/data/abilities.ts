import { inBounds, isHole, pieceAt } from '../core/board';
import type { AbilityDef, BoardMutation } from '../core/abilities';
import type { MutationId } from '../core/pieces';

export const ABILITIES: Record<MutationId, AbilityDef> = {
  pawnLandmine: {
    id: 'pawnLandmine',
    icon: '💥',
    name: 'Death Blast',
    description: 'When this pawn dies, its square becomes a pit. Any piece that steps on a pit falls in and is lost.',
    trigger: 'onDeath',
    pieceType: 'pawn',
    rarity: 'common',
    effect: ({ piece }) => [{ type: 'destroyTile', pos: piece.pos }],
  },
  pawnZealot: {
    id: 'pawnZealot',
    icon: '🔆',
    name: 'Death Cross',
    description: 'When this pawn dies, the 4 squares next to it (up, down, left, right) become pits.',
    trigger: 'onDeath',
    pieceType: 'pawn',
    rarity: 'rare',
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
    icon: '🐎',
    name: 'Corner Break',
    description: 'When this knight captures, the corner square it jumped around becomes a pit.',
    trigger: 'onCapture',
    pieceType: 'knight',
    rarity: 'common',
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
    icon: '🥷',
    name: 'Shadow Step',
    description: 'When this knight captures, the square it jumped from becomes a pit.',
    trigger: 'onCapture',
    pieceType: 'knight',
    rarity: 'uncommon',
    effect: ({ move }) => {
      if (!move) return [];
      return [{ type: 'destroyTile', pos: move.from }];
    },
  },
  bishopArsonist: {
    id: 'bishopArsonist',
    icon: '🔥',
    name: 'Burn Path',
    description: 'When this bishop captures, the next square past the victim (same diagonal) becomes a pit.',
    trigger: 'onCapture',
    pieceType: 'bishop',
    rarity: 'common',
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
    icon: '✨',
    name: 'Repair',
    description: 'Button, once per battle: fixes one pit next to this bishop.',
    trigger: 'activated',
    pieceType: 'bishop',
    rarity: 'uncommon',
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
    icon: '🔨',
    name: 'Ram',
    description: 'When this rook captures, the square directly behind the victim becomes a pit.',
    trigger: 'onCapture',
    pieceType: 'rook',
    rarity: 'common',
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
    icon: '💣',
    name: 'Double Ram',
    description: 'When this rook captures, the two squares behind the victim become pits.',
    trigger: 'onCapture',
    pieceType: 'rook',
    rarity: 'rare',
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
    icon: '🌋',
    name: 'Earthquake',
    description: 'Button, once per battle: the 8 squares around this queen become pits. Pieces standing on them fall in.',
    trigger: 'activated',
    pieceType: 'queen',
    rarity: 'rare',
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
    icon: '☄️',
    name: 'Cataclysm',
    description: 'Button, once per battle: every square within 2 of this queen becomes a pit (24 squares). Pieces standing on them fall in.',
    trigger: 'activated',
    pieceType: 'queen',
    rarity: 'legendary',
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
    icon: '🛡️',
    name: 'Safe Square',
    description: 'Always on: the square under this king can never become a pit.',
    trigger: 'onDeath',
    pieceType: 'king',
    rarity: 'uncommon',
    // Passive — enforced directly in combat.ts's processMutationQueue rather than fired as an event.
    effect: () => [],
  },

  // --- Tradeoff relics: real value, real cost — Castlevania-style cursed-item design. ---

  pawnBloodFrenzy: {
    id: 'pawnBloodFrenzy',
    icon: '🩸',
    name: 'Frenzy',
    description: 'When this pawn captures, the square it attacked from becomes a pit. Tradeoff: this pawn is frozen for 1 turn.',
    trigger: 'onCapture',
    pieceType: 'pawn',
    rarity: 'uncommon',
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
    icon: '⛓️',
    name: 'Chain Freeze',
    description: 'When this rook captures, the closest enemy next to the victim is frozen for 1 turn. Tradeoff: this rook is frozen for 1 turn too.',
    trigger: 'onCapture',
    pieceType: 'rook',
    rarity: 'rare',
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
    icon: '💠',
    name: 'Royal Repair',
    description: 'Button, once per battle: fixes every pit next to this king. Tradeoff: this king is frozen for 1 turn.',
    trigger: 'activated',
    pieceType: 'king',
    rarity: 'legendary',
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
