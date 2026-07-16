import { type Board, cloneBoard } from './board';
import { applyMove } from './combat';
import type { Color, PieceType } from './pieces';
import { allLegalMoves, isKingCaptured, type Move } from './rules';

const PIECE_VALUES: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 1000,
};

function evaluate(board: Board, color: Color): number {
  let score = 0;
  for (const piece of board.pieces) {
    const value = PIECE_VALUES[piece.type];
    score += piece.color === color ? value : -value;
  }
  return score;
}

/** Picks a move for `color` using a shallow (~2-ply) material-based search. */
export function chooseAiMove(board: Board, color: Color): Move | undefined {
  const moves = allLegalMoves(board, color);
  if (moves.length === 0) return undefined;

  const opponent: Color = color === 'white' ? 'black' : 'white';
  let bestMove: Move | undefined;
  let bestScore = -Infinity;

  for (const move of moves) {
    const afterMyMove = cloneBoard(board);
    applyMove(afterMyMove, move);

    if (isKingCaptured(afterMyMove, opponent)) {
      return move; // immediate win, take it
    }

    let worstReplyScore = -Infinity;
    const replies = allLegalMoves(afterMyMove, opponent);
    if (replies.length === 0) {
      worstReplyScore = evaluate(afterMyMove, color);
    } else {
      for (const reply of replies) {
        const afterReply = cloneBoard(afterMyMove);
        applyMove(afterReply, reply);
        worstReplyScore = Math.max(worstReplyScore, -evaluate(afterReply, color));
      }
    }

    const score = -worstReplyScore + Math.random() * 0.1;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove ?? moves[Math.floor(Math.random() * moves.length)];
}
