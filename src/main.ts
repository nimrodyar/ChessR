import './style.css';
import { createInitialBoard, pieceAt, type Board } from './core/board';
import { legalMoves, type Move } from './core/rules';
import { activateAbility, applyMove, canActivate, type AnimationStep } from './core/combat';
import { chooseAiMove } from './core/ai';
import { createScene3D, tickAmbient } from './render/three/scene3d';
import { BoardView3D } from './render/three/boardView3d';
import { PieceView3D } from './render/three/pieceView3d';
import { playAnimations } from './render/three/effects3d';
import { Hud } from './ui/hud';
import { RewardScreen } from './ui/rewardScreen';
import { ABILITIES } from './data/abilities';
import type { Color, MutationId, Piece, PieceType, Position } from './core/pieces';

const PIECE_TYPE_FOR_MUTATION: Record<MutationId, PieceType> = {
  pawnLandmine: 'pawn',
  knightCharge: 'knight',
  rookDemolisher: 'rook',
  queenEarthquake: 'queen',
};

const ALL_MUTATIONS: MutationId[] = ['pawnLandmine', 'knightCharge', 'rookDemolisher', 'queenEarthquake'];

interface TurnOutcome {
  animations: AnimationStep[];
  winner?: Color;
}

async function main(): Promise<void> {
  const appEl = document.querySelector<HTMLDivElement>('#app');
  if (!appEl) throw new Error('#app root element missing');
  appEl.innerHTML = '';

  const titleEl = document.createElement('div');
  titleEl.className = 'demo-title';
  titleEl.innerHTML = '<h1>Chess Rogue</h1><p>— a board consecrated in guilt —</p>';
  appEl.appendChild(titleEl);

  const scene3d = createScene3D(appEl);
  const boardView = new BoardView3D(scene3d);
  const pieceView = new PieceView3D(scene3d);

  const rewardScreen = new RewardScreen(appEl);

  let board: Board = createInitialBoard();
  let currentTurn: Color = 'white';
  let selected: Piece | null = null;
  let selectedMoves: Move[] = [];
  let inputLocked = false;
  let gameOver = false;
  const ownedMutations = new Set<MutationId>();

  const hud = new Hud(appEl, {
    onRestart: () => startBattle(),
    onActivateAbility: () => void activateQueenAbility(),
  });

  function applyOwnedMutations(): void {
    for (const piece of board.pieces) {
      if (piece.color !== 'white') continue;
      for (const mutationId of ownedMutations) {
        if (PIECE_TYPE_FOR_MUTATION[mutationId] === piece.type && !piece.mutations.includes(mutationId)) {
          piece.mutations.push(mutationId);
        }
      }
    }
  }

  function clearSelection(): void {
    selected = null;
    selectedMoves = [];
    boardView.highlight(null, []);
  }

  function updateAbilityButton(): void {
    const queen = board.pieces.find((p) => p.color === 'white' && p.type === 'queen');
    const available =
      !gameOver && currentTurn === 'white' && !inputLocked && !!queen && canActivate(queen, 'queenEarthquake');
    hud.setAbilityAvailable(available);
  }

  function startBattle(): void {
    board = createInitialBoard();
    applyOwnedMutations();
    currentTurn = 'white';
    inputLocked = false;
    gameOver = false;
    clearSelection();
    boardView.syncBoard(board);
    pieceView.syncPieces(board.pieces);
    hud.setStatus('Your move (white)');
    updateAbilityButton();
    rewardScreen.hide();
  }

  async function handleTileClick(pos: Position): Promise<void> {
    if (inputLocked || gameOver || currentTurn !== 'white') return;

    if (selected) {
      const move = selectedMoves.find((m) => m.to.x === pos.x && m.to.y === pos.y);
      if (move) {
        clearSelection();
        await runPlayerMove(move);
        return;
      }
    }

    const clickedPiece = pieceAt(board, pos);
    if (clickedPiece && clickedPiece.color === 'white') {
      selected = clickedPiece;
      selectedMoves = legalMoves(board, clickedPiece);
      boardView.highlight(
        clickedPiece.pos,
        selectedMoves.map((m) => ({ pos: m.to, isCapture: m.isCapture })),
      );
    } else {
      clearSelection();
    }
  }

  boardView.onTileClick = (pos) => void handleTileClick(pos);

  async function resolveTurn(result: TurnOutcome): Promise<boolean> {
    await playAnimations(result.animations, pieceView, boardView, scene3d);
    boardView.syncBoard(board);
    pieceView.syncPieces(board.pieces);
    if (result.winner) {
      await onBattleEnd(result.winner);
      return true;
    }
    return false;
  }

  async function runPlayerMove(move: Move): Promise<void> {
    inputLocked = true;
    updateAbilityButton();
    const result = applyMove(board, move);
    const ended = await resolveTurn(result);
    if (ended) return;

    currentTurn = 'black';
    hud.setStatus('Opponent thinking...');
    await runAiTurn();
  }

  async function runAiTurn(): Promise<void> {
    const move = chooseAiMove(board, 'black');
    if (!move) {
      await onBattleEnd('white');
      return;
    }
    const result = applyMove(board, move);
    const ended = await resolveTurn(result);
    if (ended) return;

    currentTurn = 'white';
    inputLocked = false;
    hud.setStatus('Your move (white)');
    updateAbilityButton();
  }

  async function activateQueenAbility(): Promise<void> {
    if (inputLocked || gameOver || currentTurn !== 'white') return;
    const queen = board.pieces.find((p) => p.color === 'white' && p.type === 'queen');
    if (!queen || !canActivate(queen, 'queenEarthquake')) return;

    clearSelection();
    inputLocked = true;
    updateAbilityButton();
    hud.setStatus('Earthquake!');
    const result = activateAbility(board, queen, 'queenEarthquake');
    const ended = await resolveTurn(result);
    if (ended) return;

    currentTurn = 'black';
    hud.setStatus('Opponent thinking...');
    await runAiTurn();
  }

  async function onBattleEnd(winner: Color): Promise<void> {
    gameOver = true;
    inputLocked = true;
    hud.setAbilityAvailable(false);

    if (winner === 'white') {
      hud.setStatus('Victory!');
      const options = ALL_MUTATIONS.filter((id) => !ownedMutations.has(id))
        .slice(0, 3)
        .map((id) => ABILITIES[id]);
      rewardScreen.show(
        'You won! Choose a mutation for your next battle:',
        options,
        (mutationId) => {
          ownedMutations.add(mutationId);
          startBattle();
        },
        () => startBattle(),
      );
    } else {
      hud.setStatus('Defeat...');
      rewardScreen.show('Your king fell. Try again?', [], () => startBattle(), () => startBattle());
    }
  }

  startBattle();

  function animate(): void {
    requestAnimationFrame(animate);
    const elapsed = performance.now() / 1000;
    pieceView.tick(elapsed, selected?.id ?? null);
    tickAmbient(scene3d, elapsed);
  }
  animate();
}

void main();
