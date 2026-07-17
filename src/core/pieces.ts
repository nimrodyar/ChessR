export type Color = 'white' | 'black';
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type MutationId =
  | 'pawnLandmine'
  | 'pawnZealot'
  | 'pawnBloodFrenzy'
  | 'knightCharge'
  | 'knightShadowStep'
  | 'bishopArsonist'
  | 'bishopWard'
  | 'rookDemolisher'
  | 'rookSiegeEngine'
  | 'rookShackle'
  | 'queenEarthquake'
  | 'queenCataclysm'
  | 'queenResurrection'
  | 'kingBunker'
  | 'kingIronVigil'
  | 'kingFence';

export interface Position {
  x: number;
  y: number;
}

export interface Piece {
  id: string;
  type: PieceType;
  color: Color;
  pos: Position;
  hasMoved: boolean;
  mutations: MutationId[];
  usedActivated?: Partial<Record<MutationId, boolean>>;
  /** Turns remaining where this piece cannot move. Decremented once per its own side's turn. */
  frozenTurns?: number;
  /** King's Fence perk: while true, this king cannot be checked — the first would-be check
   * breaks the fence instead. Chess law resumes untouched once it falls. */
  fenceIntact?: boolean;
}

/** Classic material worth — used to pick the most valuable fallen piece for revival. */
export const PIECE_WORTH: Record<PieceType, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 1000,
};

export function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function opponentColor(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

export function posKey(p: Position): string {
  return `${p.x},${p.y}`;
}

let idCounter = 0;

export function makePiece(type: PieceType, color: Color, pos: Position): Piece {
  return { id: `p${idCounter++}`, type, color, pos, hasMoved: false, mutations: [] };
}

export function resetIdCounter(): void {
  idCounter = 0;
}
