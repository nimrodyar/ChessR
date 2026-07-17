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
  /** Single symbol identifying this perk at a glance — shown on cards, tooltips, panels and buttons. */
  icon: string;
  effect: (ctx: AbilityContext) => BoardMutation[];
}
