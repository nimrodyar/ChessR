import { type Board, isHole, pieceAt, removePiece } from './board';
import type { BoardMutation } from './abilities';
import { ABILITIES } from '../data/abilities';
import type { Color, MutationId, Piece, PieceType, Position } from './pieces';
import type { Move } from './rules';

export interface AnimationStep {
  type: 'move' | 'capture' | 'fallThrough' | 'destroyTile' | 'restoreTile' | 'promote';
  pieceId?: string;
  from?: Position;
  to?: Position;
  pos?: Position;
  promotedType?: PieceType;
}

export interface TurnResult {
  animations: AnimationStep[];
  winner?: Color;
}

function queueAbilities(
  piece: Piece,
  trigger: 'onDeath' | 'onCapture' | 'activated',
  move: Move | undefined,
  board: Board,
  queue: BoardMutation[],
  onlyId?: MutationId,
): void {
  for (const mutationId of piece.mutations) {
    if (onlyId && mutationId !== onlyId) continue;
    const def = ABILITIES[mutationId];
    if (def.trigger !== trigger) continue;
    queue.push(...def.effect({ board, piece, move }));
  }
}

function processMutationQueue(board: Board, queue: BoardMutation[], animations: AnimationStep[]): void {
  while (queue.length > 0) {
    const mutation = queue.shift()!;

    if (mutation.type === 'restoreTile') {
      if (!isHole(board, mutation.pos)) continue;
      board.tiles[mutation.pos.y][mutation.pos.x].state = 'normal';
      animations.push({ type: 'restoreTile', pos: mutation.pos });
      continue;
    }

    if (isHole(board, mutation.pos)) continue;
    const guardian = pieceAt(board, mutation.pos);
    if (guardian?.type === 'king' && guardian.mutations.includes('kingBunker')) continue;

    board.tiles[mutation.pos.y][mutation.pos.x].state = 'hole';
    animations.push({ type: 'destroyTile', pos: mutation.pos });

    const occupant = pieceAt(board, mutation.pos);
    if (occupant) {
      animations.push({ type: 'fallThrough', pieceId: occupant.id, pos: { ...occupant.pos } });
      removePiece(board, occupant.id);
      queueAbilities(occupant, 'onDeath', undefined, board, queue);
    }
  }
}

function determineWinner(board: Board): Color | undefined {
  const whiteKing = board.pieces.some((p) => p.color === 'white' && p.type === 'king');
  const blackKing = board.pieces.some((p) => p.color === 'black' && p.type === 'king');
  if (!whiteKing) return 'black';
  if (!blackKing) return 'white';
  return undefined;
}

export function applyMove(board: Board, move: Move): TurnResult {
  const animations: AnimationStep[] = [];
  const mutationQueue: BoardMutation[] = [];
  const piece = pieceAt(board, move.from);
  if (!piece) return { animations };

  animations.push({ type: 'move', pieceId: piece.id, from: move.from, to: move.to });

  if (move.isCapture && move.capturedId) {
    const captured = board.pieces.find((p) => p.id === move.capturedId);
    if (captured) {
      animations.push({ type: 'capture', pieceId: captured.id, pos: { ...captured.pos } });
      removePiece(board, captured.id);
      queueAbilities(captured, 'onDeath', undefined, board, mutationQueue);
    }
  }

  piece.pos = move.to;
  piece.hasMoved = true;

  if (move.promotion) {
    piece.type = 'queen';
    animations.push({ type: 'promote', pieceId: piece.id, pos: { ...piece.pos }, promotedType: 'queen' });
  }

  if (move.isCapture) {
    queueAbilities(piece, 'onCapture', move, board, mutationQueue);
  }

  processMutationQueue(board, mutationQueue, animations);

  return { animations, winner: determineWinner(board) };
}

export function canActivate(piece: Piece, abilityId: MutationId): boolean {
  return piece.mutations.includes(abilityId) && !piece.usedActivated?.[abilityId];
}

export function activateAbility(board: Board, piece: Piece, abilityId: MutationId): TurnResult {
  const animations: AnimationStep[] = [];
  if (!canActivate(piece, abilityId)) return { animations };

  piece.usedActivated = { ...piece.usedActivated, [abilityId]: true };
  const mutationQueue: BoardMutation[] = [];
  queueAbilities(piece, 'activated', undefined, board, mutationQueue, abilityId);
  processMutationQueue(board, mutationQueue, animations);

  return { animations, winner: determineWinner(board) };
}
