import { inBounds, isHole, pieceAt } from '../core/board';
import type { AbilityDef, BoardMutation } from '../core/abilities';
import type { MutationId } from '../core/pieces';

export const ABILITIES: Record<MutationId, AbilityDef> = {
  pawnLandmine: {
    id: 'pawnLandmine',
    icon: '💥',
    name: "Martyr's Charge",
    description: 'When this pawn is slain, the square it died on detonates into a bottomless pit. Any piece that later steps there falls in and is lost.',
    trigger: 'onDeath',
    pieceType: 'pawn',
    rarity: 'common',
    className: 'Barbarian',
    effect: ({ piece }) => [{ type: 'destroyTile', pos: piece.pos }],
  },
  pawnZealot: {
    id: 'pawnZealot',
    icon: '🔆',
    name: "Zealot's Last Rites",
    description: 'When this pawn is slain, a cross of holy fire shatters the four squares touching it (up, down, left, right) into pits.',
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
    icon: '🐎',
    name: 'Trampling Charge',
    description: 'When this knight kills, the corner square it leapt around is crushed into a pit.',
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
    icon: '🥷',
    name: 'Shadow Step',
    description: 'When this knight kills, the square it launched from crumbles into a pit behind it.',
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
    icon: '🔥',
    name: 'Trail of Cinders',
    description: 'When this bishop kills, its momentum burns the next square along the same diagonal (just past the victim) into a pit.',
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
    icon: '✨',
    name: 'Sanctify Ground',
    description: 'Once per battle (press its button below): mends one pit next to this bishop back into solid, walkable ground.',
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
    icon: '🔨',
    name: 'Battering Ram',
    description: "When this rook kills, the blow carries through: the square directly behind the victim (continuing the rook's line) is smashed into a pit.",
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
    icon: '💣',
    name: 'Siege Engine',
    description: "When this rook kills, the destruction rolls on: the two squares behind the victim along the rook's line are smashed into pits.",
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
    icon: '🌋',
    name: 'Earthquake',
    description: 'Once per battle (press its button below): all 8 squares around the queen collapse into pits. Any piece standing on them, friend or foe, falls in.',
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
    icon: '☄️',
    name: 'Cataclysm',
    description: 'Once per battle (press its button below): every square within 2 of the queen (a 5\u00d75 blast, 24 squares) collapses into pits. Devastating and utterly indiscriminate.',
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
    icon: '🛡️',
    name: 'Consecrated Throne',
    description: "Always active: the square under this king can never be destroyed \u2014 no blast, ally or enemy, can turn it into a pit.",
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
    icon: '🩸',
    name: 'Blood Frenzy',
    description:
      'When this pawn kills, the square it struck from shatters into a pit — but the frenzy leaves this pawn frozen (unable to move) for one turn.',
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
    icon: '⛓️',
    name: 'Chains of the Damned',
    description:
      'When this rook kills, the nearest enemy beside the victim is bound in chains (frozen, unable to move, for 1 turn) — but the recoil freezes this rook for a turn too.',
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
    icon: '💠',
    name: 'Iron Vigil',
    description:
      'Once per battle (press its button below): wardstone magic mends every pit next to the king back to solid ground — but the toll freezes the king (unable to move) for one turn.',
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
