import { type Color, type Piece, type PieceType, type Position, makePiece, posEq, resetIdCounter } from './pieces';

/** Tiles degrade in two stages: damage first CRACKS a tile (still walkable, visibly
 * telegraphed), and a cracked tile COLLAPSES into a pit only when a piece steps on it. */
export type TileState = 'normal' | 'cracked' | 'hole';

export interface Tile {
  state: TileState;
  /** Set once this tile has collapsed under a piece and killed it — only such pits
   * (or mere cracks) can be repaired back to solid ground. */
  claimedPiece?: boolean;
}

export interface Board {
  tiles: Tile[][]; // tiles[y][x]
  pieces: Piece[];
  /** Graveyard: every piece removed from play this battle, in death order — revival pulls from here. */
  fallen: Piece[];
  /** The square a pawn skipped over on its last double-step move, capturable en passant this turn only. */
  enPassantTarget?: Position;
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
  const piece = board.pieces.find((p) => p.id === pieceId);
  board.pieces = board.pieces.filter((p) => p.id !== pieceId);
  if (piece) board.fallen.push(piece);
}

export function isCracked(board: Board, pos: Position): boolean {
  return board.tiles[pos.y][pos.x].state === 'cracked';
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
  return { tiles, pieces, fallen: [] };
}

export function cloneBoard(board: Board): Board {
  const clonePiece = (p: Piece): Piece => ({
    ...p,
    pos: { ...p.pos },
    mutations: [...p.mutations],
    usedActivated: p.usedActivated ? { ...p.usedActivated } : undefined,
  });
  return {
    tiles: board.tiles.map((row) => row.map((t) => ({ ...t }))),
    pieces: board.pieces.map(clonePiece),
    fallen: board.fallen.map(clonePiece),
    enPassantTarget: board.enPassantTarget ? { ...board.enPassantTarget } : undefined,
  };
}

export type { Color, Piece, PieceType, Position };
