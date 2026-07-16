import type { AbilityDef, AbilityRarity } from './abilities';
import type { Board } from './board';
import type { MutationId } from './pieces';
import { ABILITIES } from '../data/abilities';

const RARITY_WEIGHTS: Record<AbilityRarity, number> = {
  common: 100,
  uncommon: 45,
  rare: 18,
  legendary: 6,
};

/** Draws up to `count` distinct perks, weighted by rarity, restricted to piece types the player still has on the board. */
export function pickPerkOptions(board: Board, owned: ReadonlySet<MutationId>, count = 3): AbilityDef[] {
  const availableTypes = new Set(board.pieces.filter((p) => p.color === 'white').map((p) => p.type));
  const remaining = Object.values(ABILITIES).filter((a) => !owned.has(a.id) && availableTypes.has(a.pieceType));

  const picks: AbilityDef[] = [];
  while (picks.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, a) => sum + RARITY_WEIGHTS[a.rarity], 0);
    let roll = Math.random() * totalWeight;
    let idx = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= RARITY_WEIGHTS[remaining[i].rarity];
      if (roll <= 0) {
        idx = i;
        break;
      }
    }
    picks.push(remaining.splice(idx, 1)[0]);
  }
  return picks;
}
