import { describe, expect, it } from 'vitest';
import type { Board } from './board';
import { activateAbility, applyMove, canActivate } from './combat';
import { makePiece } from './pieces';

function emptyBoard(): Board {
  return {
    tiles: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ state: 'normal' as const }))),
    pieces: [],
  };
}

describe('pawnLandmine', () => {
  it('turns the tile a mutated pawn died on into a hole', () => {
    const board = emptyBoard();
    const attacker = makePiece('rook', 'black', { x: 0, y: 5 });
    const pawn = makePiece('pawn', 'white', { x: 0, y: 4 });
    pawn.mutations.push('pawnLandmine');
    board.pieces.push(attacker, pawn);

    applyMove(board, { from: { x: 0, y: 5 }, to: { x: 0, y: 4 }, isCapture: true, capturedId: pawn.id });

    expect(board.tiles[4][0].state).toBe('hole');
    expect(board.pieces.find((p) => p.id === pawn.id)).toBeUndefined();
  });
});

describe('knightCharge', () => {
  it('destroys the L-corner tile when the knight captures', () => {
    const board = emptyBoard();
    const knight = makePiece('knight', 'white', { x: 3, y: 3 });
    knight.mutations.push('knightCharge');
    const enemy = makePiece('pawn', 'black', { x: 4, y: 1 });
    board.pieces.push(knight, enemy);

    applyMove(board, { from: { x: 3, y: 3 }, to: { x: 4, y: 1 }, isCapture: true, capturedId: enemy.id });

    // long axis of travel is y (dy=2), so the corner is (from.x, to.y)
    expect(board.tiles[1][3].state).toBe('hole');
  });
});

describe('rookDemolisher', () => {
  it('destroys the tile just beyond a captured piece', () => {
    const board = emptyBoard();
    const rook = makePiece('rook', 'white', { x: 0, y: 0 });
    rook.mutations.push('rookDemolisher');
    const enemy = makePiece('pawn', 'black', { x: 3, y: 0 });
    board.pieces.push(rook, enemy);

    applyMove(board, { from: { x: 0, y: 0 }, to: { x: 3, y: 0 }, isCapture: true, capturedId: enemy.id });

    expect(board.tiles[0][4].state).toBe('hole');
  });
});

describe('queenEarthquake', () => {
  it('destroys the 8 surrounding tiles once, dropping any piece caught in the blast, then cannot be reused', () => {
    const board = emptyBoard();
    const queen = makePiece('queen', 'white', { x: 4, y: 4 });
    queen.mutations.push('queenEarthquake');
    const bystander = makePiece('pawn', 'black', { x: 4, y: 3 });
    board.pieces.push(queen, bystander);

    expect(canActivate(queen, 'queenEarthquake')).toBe(true);
    const result = activateAbility(board, queen, 'queenEarthquake');

    const neighborOffsets = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0], [1, 0],
      [-1, 1], [0, 1], [1, 1],
    ];
    for (const [dx, dy] of neighborOffsets) {
      expect(board.tiles[4 + dy][4 + dx].state).toBe('hole');
    }
    expect(board.tiles[4][4].state).toBe('normal'); // queen's own tile is spared
    expect(board.pieces.find((p) => p.id === bystander.id)).toBeUndefined();
    expect(result.animations.some((a) => a.type === 'fallThrough' && a.pieceId === bystander.id)).toBe(true);

    expect(canActivate(queen, 'queenEarthquake')).toBe(false);
    const second = activateAbility(board, queen, 'queenEarthquake');
    expect(second.animations).toHaveLength(0);
  });
});
