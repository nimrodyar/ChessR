import { describe, expect, it } from 'vitest';
import type { Board } from './board';
import { makePiece } from './pieces';
import { pickPerkOptions, rarityForScore } from './perks';

function boardWithAllTypes(color: 'white' | 'black'): Board {
  const board: Board = {
    tiles: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ state: 'normal' as const }))),
    pieces: [],
  };
  const types = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'] as const;
  types.forEach((t, i) => board.pieces.push(makePiece(t, color, { x: i, y: 4 })));
  return board;
}

describe('rarityForScore', () => {
  it('maps the score bands to ascending rarities', () => {
    expect(rarityForScore(0)).toBe('common');
    expect(rarityForScore(0.44)).toBe('common');
    expect(rarityForScore(0.5)).toBe('uncommon');
    expect(rarityForScore(0.8)).toBe('rare');
    expect(rarityForScore(0.95)).toBe('legendary');
  });
});

describe('pickPerkOptions', () => {
  it('draws legendary perks when both skill and luck are maxed', () => {
    const board = boardWithAllTypes('white');
    // quality 1 and rng ~1 → score = 0.3 + 0.7 ≈ 1 → legendary tier targeted
    const picks = pickPerkOptions(board, new Set(), { quality: 1, count: 1, rng: () => 0.999 });
    expect(picks).toHaveLength(1);
    expect(picks[0].rarity).toBe('legendary');
  });

  it('draws common perks when skill and luck are both at rock bottom', () => {
    const board = boardWithAllTypes('white');
    const picks = pickPerkOptions(board, new Set(), { quality: 0, count: 1, rng: () => 0 });
    expect(picks).toHaveLength(1);
    expect(picks[0].rarity).toBe('common');
  });

  it('gives skill only a 30% share: a perfect move with zero luck still lands in common', () => {
    const board = boardWithAllTypes('white');
    // score = 0.3*1 + 0.7*0 = 0.3 < 0.45 → common. Good play helps, luck rules.
    const picks = pickPerkOptions(board, new Set(), { quality: 1, count: 1, rng: () => 0 });
    expect(picks[0].rarity).toBe('common');
  });

  it('restricts the draw to the requested color and its surviving piece types', () => {
    const board = boardWithAllTypes('black');
    board.pieces = board.pieces.filter((p) => p.type === 'rook' || p.type === 'king');
    const picks = pickPerkOptions(board, new Set(), { color: 'black', count: 10 });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((p) => p.pieceType === 'rook' || p.pieceType === 'king')).toBe(true);
  });

  it('honors trigger restrictions so the AI only draws passives it can use', () => {
    const board = boardWithAllTypes('black');
    const picks = pickPerkOptions(board, new Set(), {
      color: 'black',
      count: 20,
      allowedTriggers: ['onDeath', 'onCapture'],
    });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((p) => p.trigger !== 'activated')).toBe(true);
  });

  it('never offers a perk that is already owned', () => {
    const board = boardWithAllTypes('white');
    const first = pickPerkOptions(board, new Set(), { count: 20 });
    const owned = new Set(first.slice(0, 5).map((p) => p.id));
    const second = pickPerkOptions(board, owned, { count: 20 });
    expect(second.some((p) => owned.has(p.id))).toBe(false);
  });
});
