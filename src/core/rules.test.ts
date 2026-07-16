import { describe, expect, it } from 'vitest';
import type { Board } from './board';
import { createInitialBoard, pieceAt } from './board';
import { makePiece } from './pieces';
import { allLegalMoves, isCheckmate, isInCheck, isKingCaptured, isStalemate, legalMoves } from './rules';

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

describe('check safety', () => {
  it('forbids a king from moving into an attacked square', () => {
    const board = emptyBoard();
    const king = makePiece('king', 'white', { x: 4, y: 4 });
    const rook = makePiece('rook', 'black', { x: 4, y: 0 }); // pins the whole file
    board.pieces.push(king, rook);

    const moves = legalMoves(board, king);
    // Every square on the rook's file is off-limits; every other adjacent square is fine.
    expect(moves.map((m) => m.to)).not.toContainEqual({ x: 4, y: 3 });
    expect(moves.map((m) => m.to)).not.toContainEqual({ x: 4, y: 5 });
    expect(moves.map((m) => m.to)).toContainEqual({ x: 3, y: 4 });
  });

  it('forbids a pinned piece from moving off the pin line, exposing the king', () => {
    const board = emptyBoard();
    const king = makePiece('king', 'white', { x: 4, y: 7 });
    const bishop = makePiece('bishop', 'white', { x: 4, y: 5 }); // sits between king and attacker
    const rook = makePiece('rook', 'black', { x: 4, y: 0 });
    board.pieces.push(king, bishop, rook);

    const moves = legalMoves(board, bishop);
    expect(moves).toHaveLength(0); // any diagonal move abandons the pin and exposes the king
  });

  it('reports check when the king sits on an attacked square', () => {
    const board = emptyBoard();
    const king = makePiece('king', 'white', { x: 4, y: 7 });
    const rook = makePiece('rook', 'black', { x: 4, y: 0 });
    board.pieces.push(king, rook);

    expect(isInCheck(board, 'white')).toBe(true);
    expect(isInCheck(board, 'black')).toBe(false);
  });

  it('ignores threats from a frozen enemy piece', () => {
    const board = emptyBoard();
    const king = makePiece('king', 'white', { x: 4, y: 7 });
    const rook = makePiece('rook', 'black', { x: 4, y: 0 });
    rook.frozenTurns = 1;
    board.pieces.push(king, rook);

    expect(isInCheck(board, 'white')).toBe(false);
  });
});

describe('checkmate and stalemate', () => {
  it('detects a back-rank checkmate', () => {
    const board = emptyBoard();
    // Classic back-rank mate: king boxed in on the edge by its own pawns, rook delivers the check.
    const king = makePiece('king', 'white', { x: 7, y: 7 });
    const pawnA = makePiece('pawn', 'white', { x: 6, y: 6 });
    const pawnB = makePiece('pawn', 'white', { x: 7, y: 6 });
    const rook = makePiece('rook', 'black', { x: 0, y: 7 });
    board.pieces.push(king, pawnA, pawnB, rook);

    expect(isInCheck(board, 'white')).toBe(true);
    expect(isCheckmate(board, 'white')).toBe(true);
    expect(allLegalMoves(board, 'white')).toHaveLength(0);
  });

  it('does not call checkmate when a legal escape exists', () => {
    const board = emptyBoard();
    const king = makePiece('king', 'white', { x: 7, y: 7 }); // g8/h8 corner but with breathing room
    const rook = makePiece('rook', 'black', { x: 0, y: 7 });
    board.pieces.push(king, rook);

    expect(isInCheck(board, 'white')).toBe(true);
    expect(isCheckmate(board, 'white')).toBe(false); // king can step to (6,6) or (7,6) etc off the rank
  });

  it('detects stalemate: no legal moves but not in check', () => {
    const board = emptyBoard();
    // Textbook king-and-queen stalemate: white king cornered with no safe squares and not in check.
    const king = makePiece('king', 'white', { x: 0, y: 0 });
    const queen = makePiece('queen', 'black', { x: 2, y: 1 });
    const blackKing = makePiece('king', 'black', { x: 2, y: 4 });
    board.pieces.push(king, queen, blackKing);

    expect(isInCheck(board, 'white')).toBe(false);
    expect(isStalemate(board, 'white')).toBe(true);
    expect(isCheckmate(board, 'white')).toBe(false);
  });
});

describe('castling', () => {
  function castleBoard(): Board {
    const board = emptyBoard();
    board.pieces.push(makePiece('king', 'white', { x: 4, y: 7 }), makePiece('rook', 'white', { x: 7, y: 7 }));
    return board;
  }

  it('offers kingside castling when the path is clear and unattacked', () => {
    const board = castleBoard();
    const king = pieceAt(board, { x: 4, y: 7 })!;
    const moves = legalMoves(board, king);
    expect(moves.some((m) => m.castle === 'kingside' && m.to.x === 6)).toBe(true);
  });

  it('forbids castling through a square the enemy attacks', () => {
    const board = castleBoard();
    board.pieces.push(makePiece('rook', 'black', { x: 5, y: 0 })); // covers f1, on the castling path
    const king = pieceAt(board, { x: 4, y: 7 })!;
    const moves = legalMoves(board, king);
    expect(moves.some((m) => m.castle === 'kingside')).toBe(false);
  });

  it('forbids castling once the king has already moved', () => {
    const board = castleBoard();
    const king = pieceAt(board, { x: 4, y: 7 })!;
    king.hasMoved = true;
    const moves = legalMoves(board, king);
    expect(moves.some((m) => m.castle)).toBe(false);
  });

  it('moves both king and rook when a castle move is applied', async () => {
    const { applyMove } = await import('./combat');
    const board = castleBoard();
    const king = pieceAt(board, { x: 4, y: 7 })!;
    const move = legalMoves(board, king).find((m) => m.castle === 'kingside')!;
    applyMove(board, move);
    expect(pieceAt(board, { x: 6, y: 7 })?.type).toBe('king');
    expect(pieceAt(board, { x: 5, y: 7 })?.type).toBe('rook');
  });
});

describe('en passant', () => {
  it('allows capturing a pawn that just double-stepped beside it', async () => {
    const { applyMove } = await import('./combat');
    const board = emptyBoard();
    const whitePawn = makePiece('pawn', 'white', { x: 3, y: 3 });
    const blackPawn = makePiece('pawn', 'black', { x: 4, y: 1 });
    board.pieces.push(whitePawn, blackPawn);

    applyMove(board, { from: { x: 4, y: 1 }, to: { x: 4, y: 3 }, isCapture: false });
    expect(board.enPassantTarget).toEqual({ x: 4, y: 2 });

    const moves = legalMoves(board, whitePawn);
    const ep = moves.find((m) => m.enPassant);
    expect(ep).toBeDefined();
    expect(ep?.to).toEqual({ x: 4, y: 2 });

    applyMove(board, ep!);
    expect(pieceAt(board, { x: 4, y: 3 })).toBeUndefined(); // the pawn that double-stepped is gone
    expect(pieceAt(board, { x: 4, y: 2 })?.color).toBe('white');
  });

  it('expires the en passant window after one move', async () => {
    const { applyMove } = await import('./combat');
    const board = emptyBoard();
    const whitePawn = makePiece('pawn', 'white', { x: 3, y: 3 });
    const blackPawn = makePiece('pawn', 'black', { x: 4, y: 1 });
    const filler = makePiece('pawn', 'black', { x: 0, y: 1 });
    board.pieces.push(whitePawn, blackPawn, filler);

    applyMove(board, { from: { x: 4, y: 1 }, to: { x: 4, y: 3 }, isCapture: false });
    applyMove(board, { from: { x: 0, y: 1 }, to: { x: 0, y: 2 }, isCapture: false }); // unrelated move
    expect(board.enPassantTarget).toBeUndefined();

    const moves = legalMoves(board, whitePawn);
    expect(moves.some((m) => m.enPassant)).toBe(false);
  });
});
