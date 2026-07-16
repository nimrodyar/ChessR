import { describe, expect, it } from 'vitest';
import type { Board } from './board';
import { activateAbility, applyMove, canActivate, tickFrozenStatuses } from './combat';
import { makePiece } from './pieces';
import { legalMoves } from './rules';

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

describe('kingBunker', () => {
  it('protects the tile a bunkered king stands on from destruction', () => {
    const board = emptyBoard();
    const queen = makePiece('queen', 'black', { x: 4, y: 4 });
    queen.mutations.push('queenEarthquake');
    const king = makePiece('king', 'white', { x: 4, y: 3 });
    king.mutations.push('kingBunker');
    board.pieces.push(queen, king);

    activateAbility(board, queen, 'queenEarthquake');

    expect(board.tiles[3][4].state).toBe('normal');
    expect(board.pieces.find((p) => p.id === king.id)).toBeDefined();
  });
});

describe('bishopWard', () => {
  it('restores an adjacent hole to solid ground, once per battle', () => {
    const board = emptyBoard();
    const bishop = makePiece('bishop', 'white', { x: 3, y: 3 });
    bishop.mutations.push('bishopWard');
    board.pieces.push(bishop);
    board.tiles[3][4].state = 'hole';

    expect(canActivate(bishop, 'bishopWard')).toBe(true);
    const result = activateAbility(board, bishop, 'bishopWard');

    expect(board.tiles[3][4].state).toBe('normal');
    expect(result.animations.some((a) => a.type === 'restoreTile')).toBe(true);
    expect(canActivate(bishop, 'bishopWard')).toBe(false);
  });
});

describe('moon drop', () => {
  it('kills a piece that steps onto an existing hole tile', () => {
    const board = emptyBoard();
    const rook = makePiece('rook', 'white', { x: 0, y: 0 });
    board.pieces.push(rook);
    board.tiles[0][3].state = 'hole';

    const result = applyMove(board, { from: { x: 0, y: 0 }, to: { x: 3, y: 0 }, isCapture: false });

    expect(board.pieces.find((p) => p.id === rook.id)).toBeUndefined();
    expect(result.animations.some((a) => a.type === 'moonDrop' && a.pieceId === rook.id)).toBe(true);
    expect(board.tiles[0][3].state).toBe('hole'); // the pit remains
  });

  it('ends the battle if the king moon drops', () => {
    const board = emptyBoard();
    const king = makePiece('king', 'white', { x: 4, y: 4 });
    board.pieces.push(king, makePiece('king', 'black', { x: 0, y: 0 }));
    board.tiles[4][5].state = 'hole';

    const result = applyMove(board, { from: { x: 4, y: 4 }, to: { x: 5, y: 4 }, isCapture: false });
    expect(result.winner).toBe('black');
  });
});

describe('frozen status', () => {
  it('blocks a frozen piece from generating any legal moves', () => {
    const board = emptyBoard();
    const rook = makePiece('rook', 'white', { x: 0, y: 0 });
    rook.frozenTurns = 1;
    board.pieces.push(rook);

    expect(legalMoves(board, rook)).toHaveLength(0);
  });

  it('thaws after exactly one tick of its own side', () => {
    const board = emptyBoard();
    const rook = makePiece('rook', 'white', { x: 0, y: 0 });
    rook.frozenTurns = 1;
    board.pieces.push(rook);

    tickFrozenStatuses(board, 'white');
    expect(rook.frozenTurns).toBe(0);
    expect(legalMoves(board, rook).length).toBeGreaterThan(0);
  });

  it("only decrements the given color's pieces", () => {
    const board = emptyBoard();
    const whiteRook = makePiece('rook', 'white', { x: 0, y: 0 });
    whiteRook.frozenTurns = 2;
    board.pieces.push(whiteRook);

    tickFrozenStatuses(board, 'black');
    expect(whiteRook.frozenTurns).toBe(2);
  });
});

describe('pawnBloodFrenzy', () => {
  it('destroys the origin tile and freezes the pawn on capture', () => {
    const board = emptyBoard();
    const pawn = makePiece('pawn', 'white', { x: 3, y: 3 });
    pawn.mutations.push('pawnBloodFrenzy');
    const enemy = makePiece('pawn', 'black', { x: 4, y: 2 });
    board.pieces.push(pawn, enemy);

    applyMove(board, { from: { x: 3, y: 3 }, to: { x: 4, y: 2 }, isCapture: true, capturedId: enemy.id });

    expect(board.tiles[3][3].state).toBe('hole');
    expect(pawn.frozenTurns).toBe(2);
  });
});

describe('rookShackle', () => {
  it('freezes a nearby enemy on capture and always recoils onto the rook itself', () => {
    const board = emptyBoard();
    const rook = makePiece('rook', 'white', { x: 0, y: 0 });
    rook.mutations.push('rookShackle');
    const enemy = makePiece('pawn', 'black', { x: 3, y: 0 });
    const bystander = makePiece('pawn', 'black', { x: 3, y: 1 });
    board.pieces.push(rook, enemy, bystander);

    applyMove(board, { from: { x: 0, y: 0 }, to: { x: 3, y: 0 }, isCapture: true, capturedId: enemy.id });

    expect(bystander.frozenTurns).toBe(1);
    expect(rook.frozenTurns).toBe(2);
  });
});

describe('kingIronVigil', () => {
  it('mends every adjacent hole and freezes the king, once per battle', () => {
    const board = emptyBoard();
    const king = makePiece('king', 'white', { x: 4, y: 4 });
    king.mutations.push('kingIronVigil');
    board.pieces.push(king);
    board.tiles[3][4].state = 'hole';
    board.tiles[4][3].state = 'hole';

    expect(canActivate(king, 'kingIronVigil')).toBe(true);
    activateAbility(board, king, 'kingIronVigil');

    expect(board.tiles[3][4].state).toBe('normal');
    expect(board.tiles[4][3].state).toBe('normal');
    expect(king.frozenTurns).toBe(2);
    expect(canActivate(king, 'kingIronVigil')).toBe(false);
  });
});
