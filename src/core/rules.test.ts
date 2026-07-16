import { describe, expect, it } from 'vitest';
import type { Board } from './board';
import { createInitialBoard, pieceAt } from './board';
import { makePiece } from './pieces';
import { allLegalMoves, isKingCaptured, legalMoves } from './rules';

function emptyBoard(): Board {
  return {
    tiles: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ state: 'normal' as const }))),
    pieces: [],
  };
}

describe('legalMoves', () => {
  it('gives a starting pawn one- and two-square forward moves', () => {
    const board = createInitialBoard();
    const pawn = pieceAt(board, { x: 0, y: 6 })!;
    const moves = legalMoves(board, pawn);
    const targets = moves.map((m) => m.to);
    expect(targets).toContainEqual({ x: 0, y: 5 });
    expect(targets).toContainEqual({ x: 0, y: 4 });
    expect(moves.every((m) => !m.isCapture)).toBe(true);
  });

  it('gives a starting knight exactly two legal moves', () => {
    const board = createInitialBoard();
    const knight = pieceAt(board, { x: 1, y: 7 })!;
    const moves = legalMoves(board, knight);
    expect(moves.map((m) => m.to)).toEqual(
      expect.arrayContaining([
        { x: 0, y: 5 },
        { x: 2, y: 5 },
      ]),
    );
    expect(moves).toHaveLength(2);
  });

  it('lets a rook slide onto a hole (moon drop) but not past it', () => {
    const board = emptyBoard();
    const rook = makePiece('rook', 'white', { x: 0, y: 0 });
    board.pieces.push(rook);
    board.tiles[0][2].state = 'hole';

    const moves = legalMoves(board, rook);
    const targets = moves.map((m) => m.to);
    expect(targets).toContainEqual({ x: 1, y: 0 });
    expect(targets).toContainEqual({ x: 2, y: 0 }); // the pit itself is a legal (fatal) destination
    expect(targets).not.toContainEqual({ x: 3, y: 0 }); // but the slide can't continue past it
  });

  it('lets a knight land on a hole even though it jumps (moon drop)', () => {
    const board = emptyBoard();
    const knight = makePiece('knight', 'white', { x: 3, y: 3 });
    board.pieces.push(knight);
    board.tiles[1][4].state = 'hole'; // one of the knight's normal landing squares

    const moves = legalMoves(board, knight);
    const move = moves.find((m) => m.to.x === 4 && m.to.y === 1);
    expect(move).toBeDefined();
    expect(move?.isCapture).toBe(false);
  });

  it('lets a bishop capture an enemy piece but not slide past it', () => {
    const board = emptyBoard();
    const bishop = makePiece('bishop', 'white', { x: 0, y: 0 });
    const enemy = makePiece('pawn', 'black', { x: 2, y: 2 });
    board.pieces.push(bishop, enemy);

    const moves = legalMoves(board, bishop);
    const targets = moves.map((m) => m.to);
    expect(targets).toContainEqual({ x: 2, y: 2 });
    expect(targets).not.toContainEqual({ x: 3, y: 3 });
    expect(moves.find((m) => m.to.x === 2 && m.to.y === 2)?.isCapture).toBe(true);
  });
});

describe('isKingCaptured', () => {
  it('reports true once a color has no king left', () => {
    const board = emptyBoard();
    board.pieces.push(makePiece('king', 'black', { x: 4, y: 0 }));
    expect(isKingCaptured(board, 'white')).toBe(true);
    expect(isKingCaptured(board, 'black')).toBe(false);
  });
});

describe('allLegalMoves', () => {
  it('aggregates moves across every piece of a color', () => {
    const board = createInitialBoard();
    const moves = allLegalMoves(board, 'white');
    // 8 pawns * 2 moves + 2 knights * 2 moves = 20 legal opening moves
    expect(moves).toHaveLength(20);
  });
});
