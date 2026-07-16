import type { Board } from './board';
import type { Move } from './rules';
import type { MutationId, Piece, PieceType, Position } from './pieces';

export type BoardMutation =
  | { type: 'destroyTile'; pos: Position }
  | { type: 'restoreTile'; pos: Position }
  | { type: 'freeze'; pieceId: string; turns: number };

export type AbilityTrigger = 'onDeath' | 'onCapture' | 'activated';

export type AbilityRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface AbilityContext {
  board: Board;
  piece: Piece;
  move?: Move;
}

export interface AbilityDef {
  id: MutationId;
  name: string;
  description: string;
  trigger: AbilityTrigger;
  pieceType: PieceType;
  rarity: AbilityRarity;
  /** D&D-flavored class this perk draws from — purely cosmetic, shown on the reward card. */
  className: string;
  effect: (ctx: AbilityContext) => BoardMutation[];
}
