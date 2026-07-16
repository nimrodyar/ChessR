import './style.css';
import { createInitialBoard, pieceAt, type Board } from './core/board';
import { legalMoves, type Move } from './core/rules';
import { activateAbility, applyMove, canActivate, tickFrozenStatuses, type AnimationStep } from './core/combat';
import { chooseAiMove } from './core/ai';
import { pickPerkOptions } from './core/perks';
import { createScene3D, tickAmbient } from './render/three/scene3d';
import { BoardView3D } from './render/three/boardView3d';
import { PieceView3D } from './render/three/pieceView3d';
import { playAnimations } from './render/three/effects3d';
import { Hud, type AbilityButtonSpec } from './ui/hud';
import { RewardScreen } from './ui/rewardScreen';
import { ABILITIES } from './data/abilities';
import type { Color, MutationId, Piece, Position } from './core/pieces';

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
  let viewLocked = false;
  const ownedMutations = new Set<MutationId>();

  const hud = new Hud(appEl, {
    onRestart: () => resetRun(),
    onToggleViewLock: () => toggleViewLock(),
  });

  function toggleViewLock(): void {
    viewLocked = !viewLocked;
    scene3d.controls.enabled = !viewLocked;
    hud.setViewLocked(viewLocked);
  }

  function grantMutation(mutationId: MutationId): void {
    ownedMutations.add(mutationId);
    const pieceType = ABILITIES[mutationId].pieceType;
    for (const piece of board.pieces) {
      if (piece.color === 'white' && piece.type === pieceType && !piece.mutations.includes(mutationId)) {
        piece.mutations.push(mutationId);
      }
    }
  }

  function applyOwnedMutations(): void {
    for (const mutationId of ownedMutations) grantMutation(mutationId);
  }

  function countBlackPieces(): number {
    return board.pieces.filter((p) => p.color === 'black').length;
  }

  function offerPerk(): Promise<void> {
    return new Promise((resolve) => {
      const options = pickPerkOptions(board, ownedMutations);
      if (options.length === 0) {
        resolve();
        return;
      }
      rewardScreen.show(
        'A perk manifests from the fallen...',
        options,
        (id) => {
          grantMutation(id);
          updateAbilityButtons();
          resolve();
        },
        () => resolve(),
      );
    });
  }

  function clearSelection(): void {
    selected = null;
    selectedMoves = [];
    boardView.highlight(null, []);
    hud.setSelectedPieceInfo(null);
  }

  function showSelectedPieceInfo(piece: Piece): void {
    hud.setSelectedPieceInfo({
      label: `${piece.color} ${piece.type}`,
      abilities: piece.mutations.map((mutationId) => {
        const def = ABILITIES[mutationId];
        return { name: def.name, description: def.description, rarity: def.rarity };
      }),
    });
  }

  function updateAbilityButtons(): void {
    if (gameOver || currentTurn !== 'white' || inputLocked) {
      hud.setAbilityButtons([]);
      return;
    }
    const buttons: AbilityButtonSpec[] = [];
    for (const piece of board.pieces) {
      if (piece.color !== 'white') continue;
      for (const mutationId of piece.mutations) {
        const def = ABILITIES[mutationId];
        if (def.trigger === 'activated' && canActivate(piece, mutationId)) {
          buttons.push({
            id: `${piece.id}:${mutationId}`,
            label: `${def.name} (${piece.type})`,
            onClick: () => void activateAbilityOn(piece, mutationId),
          });
        }
      }
    }
    hud.setAbilityButtons(buttons);
  }

  function startBattle(): void {
    board = createInitialBoard();
    applyOwnedMutations();
    currentTurn = 'white';
    inputLocked = false;
    gameOver = false;
    clearSelection();
    boardView.syncBoard(board);
    pieceView.clear();
    pieceView.syncPieces(board.pieces);
    hud.setStatus('Your move (white)');
    updateAbilityButtons();
    rewardScreen.hide();
  }

  /** Fully wipes run progression (every granted perk/mutation) before starting a fresh battle —
   * used by the "Restart Battle" button and after defeat, as opposed to continuing a run after
   * a win, which intentionally keeps owned mutations. */
  function resetRun(): void {
    ownedMutations.clear();
    startBattle();
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
      if ((clickedPiece.frozenTurns ?? 0) > 0) {
        clearSelection();
        hud.setStatus('That piece is frozen solid!');
        return;
      }
      selected = clickedPiece;
      selectedMoves = legalMoves(board, clickedPiece);
      boardView.highlight(
        clickedPiece.pos,
        selectedMoves.map((m) => ({ pos: m.to, isCapture: m.isCapture })),
      );
      showSelectedPieceInfo(clickedPiece);
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
    updateAbilityButtons();
    const blackBefore = countBlackPieces();
    const result = applyMove(board, move);
    const ended = await resolveTurn(result);
    if (ended) return;
    tickFrozenStatuses(board, 'white');

    const capturesTaken = blackBefore - countBlackPieces();
    for (let i = 0; i < capturesTaken; i++) {
      await offerPerk();
    }

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
    tickFrozenStatuses(board, 'black');

    currentTurn = 'white';
    inputLocked = false;
    hud.setStatus('Your move (white)');
    updateAbilityButtons();
  }

  async function activateAbilityOn(piece: Piece, abilityId: MutationId): Promise<void> {
    if (inputLocked || gameOver || currentTurn !== 'white') return;
    if (!canActivate(piece, abilityId)) return;

    clearSelection();
    inputLocked = true;
    updateAbilityButtons();
    hud.setStatus(`${ABILITIES[abilityId].name}!`);
    const blackBefore = countBlackPieces();
    const result = activateAbility(board, piece, abilityId);
    const ended = await resolveTurn(result);
    if (ended) return;
    tickFrozenStatuses(board, 'white');

    const capturesTaken = blackBefore - countBlackPieces();
    for (let i = 0; i < capturesTaken; i++) {
      await offerPerk();
    }

    currentTurn = 'black';
    hud.setStatus('Opponent thinking...');
    await runAiTurn();
  }

  async function onBattleEnd(winner: Color): Promise<void> {
    gameOver = true;
    inputLocked = true;
    hud.setAbilityButtons([]);

    if (winner === 'white') {
      hud.setStatus('Victory!');
      rewardScreen.show('You won! Choose a parting perk:', pickPerkOptions(board, ownedMutations), (id) => {
        ownedMutations.add(id);
        startBattle();
      }, () => startBattle());
    } else {
      hud.setStatus('Defeat...');
      rewardScreen.show('Your king fell. Try again?', [], () => resetRun(), () => resetRun());
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
