import { type Board, type Color, inBounds, isHole, pieceAt } from './board';
import type { Piece, Position } from './pieces';

export interface Move {
  from: Position;
  to: Position;
  isCapture: boolean;
  capturedId?: string;
  promotion?: boolean;
}

const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_OFFSETS = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];
const KING_OFFSETS = QUEEN_DIRS;

function slideMoves(board: Board, piece: Piece, dirs: number[][]): Move[] {
  const moves: Move[] = [];
  for (const [dx, dy] of dirs) {
    let x = piece.pos.x + dx;
    let y = piece.pos.y + dy;
    while (inBounds({ x, y })) {
      if (isHole(board, { x, y })) break; // holes are impassable terrain
      const occupant = pieceAt(board, { x, y });
      if (occupant) {
        if (occupant.color !== piece.color) {
          moves.push({ from: piece.pos, to: { x, y }, isCapture: true, capturedId: occupant.id });
        }
        break;
      }
      moves.push({ from: piece.pos, to: { x, y }, isCapture: false });
      x += dx;
      y += dy;
    }
  }
  return moves;
}

function stepMoves(board: Board, piece: Piece, offsets: number[][]): Move[] {
  const moves: Move[] = [];
  for (const [dx, dy] of offsets) {
    const to = { x: piece.pos.x + dx, y: piece.pos.y + dy };
    if (!inBounds(to)) continue;
    if (isHole(board, to)) continue; // can't land on a hole, even a knight jumping over others
    const occupant = pieceAt(board, to);
    if (occupant && occupant.color === piece.color) continue;
    moves.push({ from: piece.pos, to, isCapture: !!occupant, capturedId: occupant?.id });
  }
  return moves;
}

function pawnMoves(board: Board, piece: Piece): Move[] {
  const moves: Move[] = [];
  const dir = piece.color === 'white' ? -1 : 1;
  const startRank = piece.color === 'white' ? 6 : 1;
  const promotionRank = piece.color === 'white' ? 0 : 7;

  const oneStep = { x: piece.pos.x, y: piece.pos.y + dir };
  if (inBounds(oneStep) && !isHole(board, oneStep) && !pieceAt(board, oneStep)) {
    moves.push({ from: piece.pos, to: oneStep, isCapture: false, promotion: oneStep.y === promotionRank });
    const twoStep = { x: piece.pos.x, y: piece.pos.y + dir * 2 };
    if (piece.pos.y === startRank && inBounds(twoStep) && !isHole(board, twoStep) && !pieceAt(board, twoStep)) {
      moves.push({ from: piece.pos, to: twoStep, isCapture: false });
    }
  }
  for (const dx of [-1, 1]) {
    const diag = { x: piece.pos.x + dx, y: piece.pos.y + dir };
    if (!inBounds(diag) || isHole(board, diag)) continue;
    const occupant = pieceAt(board, diag);
    if (occupant && occupant.color !== piece.color) {
      moves.push({
        from: piece.pos,
        to: diag,
        isCapture: true,
        capturedId: occupant.id,
        promotion: diag.y === promotionRank,
      });
    }
  }
  return moves;
}

export function legalMoves(board: Board, piece: Piece): Move[] {
  switch (piece.type) {
    case 'pawn':
      return pawnMoves(board, piece);
    case 'knight':
      return stepMoves(board, piece, KNIGHT_OFFSETS);
    case 'bishop':
      return slideMoves(board, piece, BISHOP_DIRS);
    case 'rook':
      return slideMoves(board, piece, ROOK_DIRS);
    case 'queen':
      return slideMoves(board, piece, QUEEN_DIRS);
    case 'king':
      return stepMoves(board, piece, KING_OFFSETS);
    default:
      return [];
  }
}

export function allLegalMoves(board: Board, color: Color): Move[] {
  return board.pieces.filter((p) => p.color === color).flatMap((p) => legalMoves(board, p));
}

export function isKingCaptured(board: Board, color: Color): boolean {
  return !board.pieces.some((p) => p.color === color && p.type === 'king');
}
