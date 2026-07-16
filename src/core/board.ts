import { type Color, type Piece, type PieceType, type Position, makePiece, posEq, resetIdCounter } from './pieces';

export type TileState = 'normal' | 'hole';

export interface Tile {
  state: TileState;
}

export interface Board {
  tiles: Tile[][]; // tiles[y][x]
  pieces: Piece[];
}

export const BOARD_SIZE = 8;

const BACK_RANK: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

export function inBounds(pos: Position): boolean {
  return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE;
}

export function isHole(board: Board, pos: Position): boolean {
  return board.tiles[pos.y][pos.x].state === 'hole';
}

export function pieceAt(board: Board, pos: Position): Piece | undefined {
  return board.pieces.find((p) => posEq(p.pos, pos));
}

export function removePiece(board: Board, pieceId: string): void {
  board.pieces = board.pieces.filter((p) => p.id !== pieceId);
}

export function createInitialBoard(): Board {
  resetIdCounter();
  const tiles: Tile[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({ state: 'normal' as TileState })),
  );
  const pieces: Piece[] = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    pieces.push(makePiece(BACK_RANK[x], 'black', { x, y: 0 }));
    pieces.push(makePiece('pawn', 'black', { x, y: 1 }));
    pieces.push(makePiece('pawn', 'white', { x, y: 6 }));
    pieces.push(makePiece(BACK_RANK[x], 'white', { x, y: 7 }));
  }
  return { tiles, pieces };
}

export function cloneBoard(board: Board): Board {
  return {
    tiles: board.tiles.map((row) => row.map((t) => ({ ...t }))),
    pieces: board.pieces.map((p) => ({
      ...p,
      pos: { ...p.pos },
      mutations: [...p.mutations],
      usedActivated: p.usedActivated ? { ...p.usedActivated } : undefined,
    })),
  };
}

export type { Color, Piece, PieceType, Position };
