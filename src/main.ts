import './style.css';
import { createInitialBoard, pieceAt, type Board } from './core/board';
import { isCheckmate, isInCheck, isStalemate, legalMoves, type Move } from './core/rules';
import { activateAbility, applyMove, canActivate, tickFrozenStatuses, type AnimationStep } from './core/combat';
import { chooseAiMove } from './core/ai';
import { pickPerkOptions } from './core/perks';
import { createScene3D, tickAmbient } from './render/three/scene3d';
import { BoardView3D } from './render/three/boardView3d';
import { PieceView3D } from './render/three/pieceView3d';
import { playAnimations } from './render/three/effects3d';
import { Hud, type AbilityButtonSpec } from './ui/hud';
import { RewardScreen } from './ui/rewardScreen';
import { ChoiceOverlay } from './ui/choiceOverlay';
import { ABILITIES } from './data/abilities';
import { opponentColor, type Color, type MutationId, type Piece, type PieceType, type Position } from './core/pieces';

interface TurnOutcome {
  animations: AnimationStep[];
  winner?: Color;
}

const PROMOTION_CHOICES: { id: PieceType; label: string }[] = [
  { id: 'queen', label: 'Queen' },
  { id: 'rook', label: 'Rook' },
  { id: 'bishop', label: 'Bishop' },
  { id: 'knight', label: 'Knight' },
];

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
  const colorSelect = new ChoiceOverlay<Color>(appEl);
  const promotionSelect = new ChoiceOverlay<PieceType>(appEl);

  let board: Board = createInitialBoard();
  let currentTurn: Color = 'white';
  let humanColor: Color = 'white';
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

  function aiColor(): Color {
    return opponentColor(humanColor);
  }

  function toggleViewLock(): void {
    viewLocked = !viewLocked;
    scene3d.controls.enabled = !viewLocked;
    hud.setViewLocked(viewLocked);
  }

  function grantMutation(mutationId: MutationId): void {
    ownedMutations.add(mutationId);
    const pieceType = ABILITIES[mutationId].pieceType;
    for (const piece of board.pieces) {
      if (piece.color === humanColor && piece.type === pieceType && !piece.mutations.includes(mutationId)) {
        piece.mutations.push(mutationId);
      }
    }
  }

  function applyOwnedMutations(): void {
    for (const mutationId of ownedMutations) grantMutation(mutationId);
  }

  function countPieces(color: Color): number {
    return board.pieces.filter((p) => p.color === color).length;
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

  function choosePromotion(): Promise<PieceType> {
    return new Promise((resolve) => {
      promotionSelect.show('Promote your pawn', null, PROMOTION_CHOICES, resolve);
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
    if (gameOver || currentTurn !== humanColor || inputLocked) {
      hud.setAbilityButtons([]);
      return;
    }
    const buttons: AbilityButtonSpec[] = [];
    for (const piece of board.pieces) {
      if (piece.color !== humanColor) continue;
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

  function showColorPicker(onChosen: () => void): void {
    colorSelect.show(
      'Choose Your Side',
      'White always moves first — classic chess law, no exceptions.',
      [
        { id: 'white', label: 'Play as White', description: 'You open the game.' },
        { id: 'black', label: 'Play as Black', description: 'The AI opens; you answer.' },
      ],
      (color) => {
        humanColor = color;
        onChosen();
      },
    );
  }

  function startBattle(): void {
    board = createInitialBoard();
    applyOwnedMutations();
    currentTurn = 'white';
    gameOver = false;
    clearSelection();
    boardView.syncBoard(board);
    pieceView.clear();
    pieceView.syncPieces(board.pieces);
    scene3d.worldGroup.rotation.y = humanColor === 'black' ? Math.PI : 0;
    rewardScreen.hide();

    if (currentTurn === humanColor) {
      inputLocked = false;
      hud.setStatus(`Your move (${humanColor})`);
      updateAbilityButtons();
    } else {
      inputLocked = true;
      hud.setStatus('Opponent thinking...');
      updateAbilityButtons();
      void runAiTurn();
    }
  }

  /** Fully wipes run progression (every granted perk/mutation) before starting a fresh battle —
   * used by the "Restart Battle" button and after defeat, as opposed to continuing a run after
   * a win, which intentionally keeps owned mutations. Re-offers the color choice since it's the
   * start of a new run. */
  function resetRun(): void {
    ownedMutations.clear();
    showColorPicker(() => startBattle());
  }

  async function handleTileClick(pos: Position): Promise<void> {
    if (inputLocked || gameOver || currentTurn !== humanColor) return;

    if (selected) {
      const move = selectedMoves.find((m) => m.to.x === pos.x && m.to.y === pos.y);
      if (move) {
        clearSelection();
        if (move.promotion) {
          move.promotionType = await choosePromotion();
        }
        await runPlayerMove(move);
        return;
      }
    }

    const clickedPiece = pieceAt(board, pos);
    if (clickedPiece && clickedPiece.color === humanColor) {
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

  /** After `moverColor` finishes acting, hands the turn to whichever side moves next — ending
   * the battle immediately on checkmate (a win) or stalemate (a draw), per classic chess law. */
  async function advanceTurnAfter(moverColor: Color): Promise<boolean> {
    const nextColor = opponentColor(moverColor);
    if (isCheckmate(board, nextColor)) {
      await onBattleEnd(moverColor);
      return true;
    }
    if (isStalemate(board, nextColor)) {
      await onDraw();
      return true;
    }

    currentTurn = nextColor;
    const checkSuffix = isInCheck(board, nextColor) ? ' — Check!' : '';
    if (nextColor === humanColor) {
      inputLocked = false;
      hud.setStatus(`Your move (${humanColor})${checkSuffix}`);
      updateAbilityButtons();
    } else {
      hud.setStatus(`Opponent thinking...${checkSuffix}`);
      await runAiTurn();
    }
    return false;
  }

  async function runPlayerMove(move: Move): Promise<void> {
    inputLocked = true;
    updateAbilityButtons();
    const opponentBefore = countPieces(aiColor());
    const result = applyMove(board, move);
    const ended = await resolveTurn(result);
    if (ended) return;
    tickFrozenStatuses(board, humanColor);

    const capturesTaken = opponentBefore - countPieces(aiColor());
    for (let i = 0; i < capturesTaken; i++) {
      await offerPerk();
    }

    await advanceTurnAfter(humanColor);
  }

  async function runAiTurn(): Promise<void> {
    const move = chooseAiMove(board, aiColor());
    if (!move) {
      // Defensive fallback — advanceTurnAfter already catches checkmate/stalemate before this
      // is ever reached, but a missing move would otherwise hang the game.
      await onBattleEnd(humanColor);
      return;
    }
    const result = applyMove(board, move);
    const ended = await resolveTurn(result);
    if (ended) return;
    tickFrozenStatuses(board, aiColor());

    await advanceTurnAfter(aiColor());
  }

  async function activateAbilityOn(piece: Piece, abilityId: MutationId): Promise<void> {
    if (inputLocked || gameOver || currentTurn !== humanColor) return;
    if (!canActivate(piece, abilityId)) return;

    clearSelection();
    inputLocked = true;
    updateAbilityButtons();
    hud.setStatus(`${ABILITIES[abilityId].name}!`);
    const opponentBefore = countPieces(aiColor());
    const result = activateAbility(board, piece, abilityId);
    const ended = await resolveTurn(result);
    if (ended) return;
    tickFrozenStatuses(board, humanColor);

    const capturesTaken = opponentBefore - countPieces(aiColor());
    for (let i = 0; i < capturesTaken; i++) {
      await offerPerk();
    }

    await advanceTurnAfter(humanColor);
  }

  async function onBattleEnd(winner: Color): Promise<void> {
    gameOver = true;
    inputLocked = true;
    hud.setAbilityButtons([]);

    if (winner === humanColor) {
      hud.setStatus('Checkmate — Victory!');
      rewardScreen.show('Checkmate! Choose a parting perk:', pickPerkOptions(board, ownedMutations), (id) => {
        ownedMutations.add(id);
        startBattle();
      }, () => startBattle());
    } else {
      hud.setStatus('Checkmate — Defeat...');
      rewardScreen.show('Your king is checkmated. Try again?', [], () => resetRun(), () => resetRun());
    }
  }

  async function onDraw(): Promise<void> {
    gameOver = true;
    inputLocked = true;
    hud.setAbilityButtons([]);
    hud.setStatus('Stalemate — a draw.');
    rewardScreen.show('Stalemate! Neither side can move. Try again?', [], () => resetRun(), () => resetRun());
  }

  showColorPicker(() => startBattle());

  function animate(): void {
    requestAnimationFrame(animate);
    const elapsed = performance.now() / 1000;
    pieceView.tick(elapsed, selected?.id ?? null);
    tickAmbient(scene3d, elapsed);
  }
  animate();
}

void main();
