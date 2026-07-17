import { type Board, isCracked, isHole, pieceAt, removePiece } from './board';
import type { BoardMutation } from './abilities';
import { ABILITIES } from '../data/abilities';
import { PIECE_WORTH, type Color, type MutationId, type Piece, type PieceType, type Position } from './pieces';
import type { Move } from './rules';

export interface AnimationStep {
  type:
    | 'move'
    | 'capture'
    | 'fallThrough'
    | 'crackTile'
    | 'destroyTile'
    | 'restoreTile'
    | 'promote'
    | 'moonDrop'
    | 'freeze'
    | 'revive';
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
      const tile = board.tiles[mutation.pos.y][mutation.pos.x];
      // Cracks can always be mended; a full pit only once it has claimed a piece —
      // the abyss must be fed before it releases its ground.
      const repairable = tile.state === 'cracked' || (tile.state === 'hole' && tile.claimedPiece);
      if (!repairable) continue;
      tile.state = 'normal';
      tile.claimedPiece = false;
      animations.push({ type: 'restoreTile', pos: mutation.pos });
      continue;
    }

    if (mutation.type === 'freeze') {
      const target = board.pieces.find((p) => p.id === mutation.pieceId);
      if (!target) continue;
      target.frozenTurns = (target.frozenTurns ?? 0) + mutation.turns;
      animations.push({ type: 'freeze', pieceId: target.id, pos: { ...target.pos } });
      continue;
    }

    if (mutation.type === 'revive') {
      // Return the most valuable fallen piece of this color to the battlefield.
      const candidates = board.fallen.filter((p) => p.color === mutation.color && p.type !== 'king');
      if (candidates.length === 0) continue;
      const revived = candidates.reduce((best, p) => (PIECE_WORTH[p.type] > PIECE_WORTH[best.type] ? p : best));
      board.fallen = board.fallen.filter((p) => p.id !== revived.id);
      revived.pos = { ...mutation.pos };
      revived.frozenTurns = 0;
      board.pieces.push(revived);
      animations.push({ type: 'revive', pieceId: revived.id, pos: { ...mutation.pos } });
      continue;
    }

    // destroyTile: two-stage damage. Solid ground CRACKS (telegraphed, still walkable);
    // a cracked tile struck again COLLAPSES into the abyss, taking any occupant with it.
    const tile = board.tiles[mutation.pos.y][mutation.pos.x];
    if (tile.state === 'hole') continue;
    const guardian = pieceAt(board, mutation.pos);
    if (guardian?.type === 'king' && guardian.mutations.includes('kingBunker')) continue;

    if (tile.state === 'normal') {
      tile.state = 'cracked';
      animations.push({ type: 'crackTile', pos: mutation.pos });
      continue;
    }

    tile.state = 'hole';
    animations.push({ type: 'destroyTile', pos: mutation.pos });
    const occupant = pieceAt(board, mutation.pos);
    if (occupant) {
      tile.claimedPiece = true;
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

  const isPawnDoubleStep = piece.type === 'pawn' && Math.abs(move.to.y - move.from.y) === 2;
  board.enPassantTarget = isPawnDoubleStep
    ? { x: move.to.x, y: (move.from.y + move.to.y) / 2 }
    : undefined;

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

  if (move.castle) {
    const y = move.from.y;
    const rookFromX = move.castle === 'kingside' ? 7 : 0;
    const rookToX = move.castle === 'kingside' ? 5 : 3;
    const rook = pieceAt(board, { x: rookFromX, y });
    if (rook) {
      animations.push({ type: 'move', pieceId: rook.id, from: { ...rook.pos }, to: { x: rookToX, y } });
      rook.pos = { x: rookToX, y };
      rook.hasMoved = true;
    }
  }

  if (isHole(board, move.to)) {
    // "Moon drop" — the piece stepped onto an existing pit and plunges through.
    animations.push({ type: 'moonDrop', pieceId: piece.id, pos: { ...piece.pos } });
    removePiece(board, piece.id);
    queueAbilities(piece, 'onDeath', undefined, board, mutationQueue);
  } else if (isCracked(board, move.to)) {
    // Cracked ground gives way underfoot: the tile collapses into a pit and the piece
    // falls with it. The pit has now claimed a victim, which makes it repairable.
    const tile = board.tiles[move.to.y][move.to.x];
    tile.state = 'hole';
    tile.claimedPiece = true;
    animations.push({ type: 'destroyTile', pos: { ...move.to } });
    animations.push({ type: 'moonDrop', pieceId: piece.id, pos: { ...piece.pos } });
    removePiece(board, piece.id);
    queueAbilities(piece, 'onDeath', undefined, board, mutationQueue);
  } else {
    if (move.promotion) {
      const promotedType = move.promotionType ?? 'queen';
      piece.type = promotedType;
      animations.push({ type: 'promote', pieceId: piece.id, pos: { ...piece.pos }, promotedType });
    }

    if (move.isCapture) {
      queueAbilities(piece, 'onCapture', move, board, mutationQueue);
    }
  }

  processMutationQueue(board, mutationQueue, animations);

  return { animations, winner: determineWinner(board) };
}

/** Ticks down frozen-status counters for one side, called once at the end of that side's own turn. */
export function tickFrozenStatuses(board: Board, color: Color): void {
  for (const piece of board.pieces) {
    if (piece.color === color && piece.frozenTurns) {
      piece.frozenTurns = Math.max(0, piece.frozenTurns - 1);
    }
  }
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
