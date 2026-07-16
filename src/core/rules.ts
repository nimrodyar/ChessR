import { type Board, cloneBoard, type Color, inBounds, isHole, pieceAt, removePiece } from './board';
import { opponentColor, posEq, type Piece, type PieceType, type Position } from './pieces';

export interface Move {
  from: Position;
  to: Position;
  isCapture: boolean;
  capturedId?: string;
  promotion?: boolean;
  /** Piece type the pawn becomes on promotion; defaults to queen if omitted. */
  promotionType?: PieceType;
  /** Set when this move is an en passant capture — capturedId points at the pawn beside `to`, not on it. */
  enPassant?: boolean;
  /** Set when this move is a castle; the rook is relocated alongside the king by applyMove. */
  castle?: 'kingside' | 'queenside';
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
      if (isHole(board, { x, y })) {
        // A hole can be stepped into — the piece plunges through ("moon drop") — but the
        // pit is a dead end, so the slide can't continue past it in this direction.
        moves.push({ from: piece.pos, to: { x, y }, isCapture: false });
        break;
      }
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
    if (isHole(board, to)) {
      // Stepping onto a hole is legal but fatal — the piece falls through ("moon drop").
      moves.push({ from: piece.pos, to, isCapture: false });
      continue;
    }
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
  if (inBounds(oneStep) && !pieceAt(board, oneStep)) {
    const oneStepIsHole = isHole(board, oneStep);
    // A pawn can walk into a hole and fall through ("moon drop"); promotion is moot if it dies.
    moves.push({ from: piece.pos, to: oneStep, isCapture: false, promotion: !oneStepIsHole && oneStep.y === promotionRank });
    const twoStep = { x: piece.pos.x, y: piece.pos.y + dir * 2 };
    // The two-square opening move needs solid ground to pass through — a pit in the way blocks it.
    if (!oneStepIsHole && piece.pos.y === startRank && inBounds(twoStep) && !pieceAt(board, twoStep)) {
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
    } else if (!occupant && board.enPassantTarget && posEq(diag, board.enPassantTarget)) {
      // En passant: the captured pawn sits beside (not on) the destination square.
      const capturedPawn = pieceAt(board, { x: diag.x, y: piece.pos.y });
      if (capturedPawn && capturedPawn.color !== piece.color && capturedPawn.type === 'pawn') {
        moves.push({ from: piece.pos, to: diag, isCapture: true, capturedId: capturedPawn.id, enPassant: true });
      }
    }
  }
  return moves;
}

/** Does a piece of `byColor` currently threaten `target`? Frozen pieces exert no threat — they cannot act. */
export function isSquareAttacked(board: Board, target: Position, byColor: Color): boolean {
  for (const piece of board.pieces) {
    if (piece.color !== byColor) continue;
    if (piece.frozenTurns && piece.frozenTurns > 0) continue;
    switch (piece.type) {
      case 'pawn': {
        const dir = piece.color === 'white' ? -1 : 1;
        if (Math.abs(piece.pos.x - target.x) === 1 && target.y === piece.pos.y + dir) return true;
        break;
      }
      case 'knight':
        if (KNIGHT_OFFSETS.some(([dx, dy]) => piece.pos.x + dx === target.x && piece.pos.y + dy === target.y)) {
          return true;
        }
        break;
      case 'king':
        if (KING_OFFSETS.some(([dx, dy]) => piece.pos.x + dx === target.x && piece.pos.y + dy === target.y)) {
          return true;
        }
        break;
      case 'bishop':
        if (rayAttacks(board, piece.pos, BISHOP_DIRS, target)) return true;
        break;
      case 'rook':
        if (rayAttacks(board, piece.pos, ROOK_DIRS, target)) return true;
        break;
      case 'queen':
        if (rayAttacks(board, piece.pos, QUEEN_DIRS, target)) return true;
        break;
    }
  }
  return false;
}

function rayAttacks(board: Board, from: Position, dirs: number[][], target: Position): boolean {
  for (const [dx, dy] of dirs) {
    let x = from.x + dx;
    let y = from.y + dy;
    while (inBounds({ x, y })) {
      if (x === target.x && y === target.y) return true;
      if (isHole(board, { x, y }) || pieceAt(board, { x, y })) break;
      x += dx;
      y += dy;
    }
  }
  return false;
}

function findKing(board: Board, color: Color): Piece | undefined {
  return board.pieces.find((p) => p.color === color && p.type === 'king');
}

export function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king.pos, opponentColor(color));
}

/** Simulates `move` on a scratch board and reports whether it would leave `color`'s own king in check. */
function wouldExposeKing(board: Board, move: Move, color: Color): boolean {
  const scratch = cloneBoard(board);
  const piece = pieceAt(scratch, move.from);
  if (!piece) return false;
  if (move.isCapture && move.capturedId) removePiece(scratch, move.capturedId);
  piece.pos = move.to;
  if (isHole(scratch, move.to)) removePiece(scratch, piece.id); // moon drop — the piece is gone either way
  return isInCheck(scratch, color);
}

function castlingMoves(board: Board, king: Piece): Move[] {
  if (king.hasMoved) return [];
  const opponent = opponentColor(king.color);
  if (isSquareAttacked(board, king.pos, opponent)) return []; // can't castle out of check
  const y = king.pos.y;
  const moves: Move[] = [];

  const kingsideRook = pieceAt(board, { x: 7, y });
  if (kingsideRook && kingsideRook.type === 'rook' && kingsideRook.color === king.color && !kingsideRook.hasMoved) {
    const between = [5, 6];
    const clear = between.every((x) => !pieceAt(board, { x, y }) && !isHole(board, { x, y }));
    const safe = between.every((x) => !isSquareAttacked(board, { x, y }, opponent));
    if (clear && safe) moves.push({ from: king.pos, to: { x: 6, y }, isCapture: false, castle: 'kingside' });
  }

  const queensideRook = pieceAt(board, { x: 0, y });
  if (queensideRook && queensideRook.type === 'rook' && queensideRook.color === king.color && !queensideRook.hasMoved) {
    const between = [1, 2, 3];
    const clear = between.every((x) => !pieceAt(board, { x, y }) && !isHole(board, { x, y }));
    const safe = [2, 3].every((x) => !isSquareAttacked(board, { x, y }, opponent));
    if (clear && safe) moves.push({ from: king.pos, to: { x: 2, y }, isCapture: false, castle: 'queenside' });
  }

  return moves;
}

function pseudoLegalMoves(board: Board, piece: Piece): Move[] {
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
      return [...stepMoves(board, piece, KING_OFFSETS), ...castlingMoves(board, piece)];
    default:
      return [];
  }
}

/** Fully legal moves for a single piece: pseudo-legal moves, minus any that would leave its own king in check. */
export function legalMoves(board: Board, piece: Piece): Move[] {
  if (piece.frozenTurns && piece.frozenTurns > 0) return []; // frozen solid — cannot act this side's turn
  return pseudoLegalMoves(board, piece).filter((move) => !wouldExposeKing(board, move, piece.color));
}

export function allLegalMoves(board: Board, color: Color): Move[] {
  return board.pieces.filter((p) => p.color === color).flatMap((p) => legalMoves(board, p));
}

export function isKingCaptured(board: Board, color: Color): boolean {
  return !board.pieces.some((p) => p.color === color && p.type === 'king');
}

/** Checkmate per the classic rule: in check, and no legal move escapes it. */
export function isCheckmate(board: Board, color: Color): boolean {
  return isInCheck(board, color) && allLegalMoves(board, color).length === 0;
}

/** Stalemate per the classic rule: not in check, but no legal move exists — a draw. */
export function isStalemate(board: Board, color: Color): boolean {
  return !isInCheck(board, color) && allLegalMoves(board, color).length === 0;
}
