import type { Board } from './board';
import type { Move } from './rules';
import type { MutationId, Piece, Position } from './pieces';

export type BoardMutation = { type: 'destroyTile'; pos: Position };

export type AbilityTrigger = 'onDeath' | 'onCapture' | 'activated';

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
  effect: (ctx: AbilityContext) => BoardMutation[];
}
