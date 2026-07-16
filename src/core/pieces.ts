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
  | 'kingBunker'
  | 'kingIronVigil';

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
}

export function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
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
