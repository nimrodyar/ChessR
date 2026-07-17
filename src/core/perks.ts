import type { AbilityDef, AbilityRarity, AbilityTrigger } from './abilities';
import type { Board } from './board';
import type { Color, MutationId, PieceType } from './pieces';
import { ABILITIES } from '../data/abilities';

const RARITY_ORDER: AbilityRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/**
 * Maps a 0..1 draw score to a rarity tier. The score is 30% skill / 70% luck
 * (see pickPerkOptions), so a brilliant move guarantees a floor of 0.3 but the
 * top tiers still demand fortune as well as skill.
 */
export function rarityForScore(score: number): AbilityRarity {
  if (score < 0.45) return 'common';
  if (score < 0.72) return 'uncommon';
  if (score < 0.92) return 'rare';
  return 'legendary';
}

export interface PerkDrawOptions {
  /** Which side's surviving piece types the draw is restricted to. Default white. */
  color?: Color;
  /** How many distinct options to draw. Default 3. */
  count?: number;
  /** 0..1 rating of how strong the earning move was ("the chess book" score). Default 0.5 (neutral). */
  quality?: number;
  /** Restrict to certain triggers — e.g. the AI only takes passive perks it can actually use. */
  allowedTriggers?: AbilityTrigger[];
  /** Restrict to perks for one piece type — the piece that made the capture is the one upgraded. */
  pieceType?: PieceType;
  /** Injectable randomness for tests. */
  rng?: () => number;
}

/**
 * Draws distinct perk options, restricted to piece types `color` still has on the board.
 * Each slot rolls a rarity via score = 0.3 * quality + 0.7 * random — better chess earns
 * better odds, but luck keeps the majority share — then picks a random un-owned perk of
 * that rarity (falling back to the nearest populated tier).
 */
export function pickPerkOptions(board: Board, owned: ReadonlySet<MutationId>, options: PerkDrawOptions = {}): AbilityDef[] {
  const { color = 'white', count = 3, quality = 0.5, allowedTriggers, pieceType, rng = Math.random } = options;

  const availableTypes = new Set(board.pieces.filter((p) => p.color === color).map((p) => p.type));
  const remaining = Object.values(ABILITIES).filter(
    (a) =>
      !owned.has(a.id) &&
      availableTypes.has(a.pieceType) &&
      (!allowedTriggers || allowedTriggers.includes(a.trigger)) &&
      (!pieceType || a.pieceType === pieceType),
  );

  const picks: AbilityDef[] = [];
  while (picks.length < count && remaining.length > 0) {
    const score = 0.3 * quality + 0.7 * rng();
    const targetIdx = RARITY_ORDER.indexOf(rarityForScore(score));

    // Nearest populated tier: exact first, then progressively further, preferring lower rarity on ties.
    let pool: AbilityDef[] = [];
    for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
      const tier = RARITY_ORDER[targetIdx + offset];
      if (!tier) continue;
      pool = remaining.filter((a) => a.rarity === tier);
      if (pool.length > 0) break;
    }
    if (pool.length === 0) break;

    const pick = pool[Math.floor(rng() * pool.length)];
    picks.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
  }
  return picks;
}
