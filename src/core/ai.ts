import { type Board, cloneBoard } from './board';
import { applyMove } from './combat';
import { opponentColor, type Color, type PieceType } from './pieces';
import { allLegalMoves, isInCheck, isKingCaptured, type Move } from './rules';

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

/** Scores one move with a ~2-ply search: my material after the opponent's best reply.
 * Checkmating replies-exhausted positions score astronomically; stalemate scores as a dead draw. */
function scoreMove(board: Board, move: Move, color: Color): number {
  const opponent = opponentColor(color);
  const afterMyMove = cloneBoard(board);
  applyMove(afterMyMove, move);

  if (isKingCaptured(afterMyMove, opponent)) return 1_000_000;

  const replies = allLegalMoves(afterMyMove, opponent);
  if (replies.length === 0) {
    return isInCheck(afterMyMove, opponent) ? 500_000 : 0; // checkmate vs stalemate (draw)
  }

  let worstReplyScore = -Infinity;
  for (const reply of replies) {
    const afterReply = cloneBoard(afterMyMove);
    applyMove(afterReply, reply);
    worstReplyScore = Math.max(worstReplyScore, -evaluate(afterReply, color));
  }
  return -worstReplyScore;
}

/** Picks a move for `color` using a shallow (~2-ply) material-based search. */
export function chooseAiMove(board: Board, color: Color): Move | undefined {
  const moves = allLegalMoves(board, color);
  if (moves.length === 0) return undefined;

  let bestMove: Move | undefined;
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = scoreMove(board, move, color) + Math.random() * 0.1;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove ?? moves[Math.floor(Math.random() * moves.length)];
}

/**
 * Rates how good `move` is compared to every other legal move in the position, as a 0..1
 * percentile ("the chess book" score): 1 = it was the strongest move available, 0 = the worst.
 * Call BEFORE applying the move — it needs the pre-move position. Feeds the skill share of
 * the 30% skill / 70% luck perk-rarity roll.
 */
export function rateMoveQuality(board: Board, move: Move, color: Color): number {
  const moves = allLegalMoves(board, color);
  if (moves.length <= 1) return 1;

  const scores = moves.map((m) => scoreMove(board, m, color));
  const myScore = scoreMove(board, move, color);
  let below = 0;
  let equal = 0;
  for (const s of scores) {
    if (s < myScore) below++;
    else if (s === myScore) equal++;
  }
  // Midpoint rank of the tie group, so a move tied with every other still rates 0.5, not 1.
  return (below + equal * 0.5) / scores.length;
}
