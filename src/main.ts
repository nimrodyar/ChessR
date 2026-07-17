import './style.css';
import * as THREE from 'three';
import { createInitialBoard, pieceAt, type Board } from './core/board';
import { isCheckmate, isInCheck, isStalemate, legalMoves, type Move } from './core/rules';
import { activateAbility, applyMove, canActivate, tickFrozenStatuses, type AnimationStep } from './core/combat';
import { chooseAiMove, rateMoveQuality } from './core/ai';
import { pickPerkOptions } from './core/perks';
import { createScene3D, resetView, tickAmbient } from './render/three/scene3d';
import { BoardView3D } from './render/three/boardView3d';
import { PieceView3D } from './render/three/pieceView3d';
import { playAnimations } from './render/three/effects3d';
import { Hud, type AbilityButtonSpec } from './ui/hud';
import { RewardScreen } from './ui/rewardScreen';
import { ChoiceOverlay } from './ui/choiceOverlay';
import { ABILITIES } from './data/abilities';
import { opponentColor, type Color, type MutationId, type Piece, type PieceType, type Position } from './core/pieces';
import type { AbilityRarity, AbilityTrigger } from './core/abilities';

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
  /** The AI's earned perks — reset each battle, since each battle fields a fresh enemy army. */
  const aiMutations = new Set<MutationId>();

  const hud = new Hud(appEl, {
    onRestart: () => resetRun(),
    onToggleViewLock: () => toggleViewLock(),
    onResetView: () => resetView(scene3d),
  });

  function aiColor(): Color {
    return opponentColor(humanColor);
  }

  function toggleViewLock(): void {
    viewLocked = !viewLocked;
    scene3d.controls.enabled = !viewLocked;
    hud.setViewLocked(viewLocked);
  }

  function grantMutation(mutationId: MutationId, color: Color = humanColor): void {
    (color === humanColor ? ownedMutations : aiMutations).add(mutationId);
    const pieceType = ABILITIES[mutationId].pieceType;
    for (const piece of board.pieces) {
      if (piece.color === color && piece.type === pieceType && !piece.mutations.includes(mutationId)) {
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

  /** Offers a perk pick; `quality` (0..1) is how strong the earning move was — it drives 30%
   * of the rarity roll, the other 70% stays pure luck. */
  function offerPerk(quality: number): Promise<void> {
    return new Promise((resolve) => {
      const options = pickPerkOptions(board, ownedMutations, { color: humanColor, quality });
      if (options.length === 0) {
        resolve();
        return;
      }
      const flavor =
        quality >= 0.85
          ? 'A masterful strike! The board rewards brilliance...'
          : quality >= 0.55
            ? 'A worthy kill. A perk manifests from the fallen...'
            : 'A perk manifests from the fallen...';
      rewardScreen.show(
        flavor,
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

  /** The AI claims a perk for its own capture — same pool, same 30/70 skill-luck rarity rule,
   * limited to passive triggers it can actually use. Returns an announcement, or null. */
  function grantAiPerk(quality: number): string | null {
    const options = pickPerkOptions(board, aiMutations, {
      color: aiColor(),
      count: 1,
      quality,
      allowedTriggers: ['onDeath', 'onCapture'],
    });
    if (options.length === 0) return null;
    const perk = options[0];
    grantMutation(perk.id, aiColor());
    return `Enemy ${perk.pieceType}s gain ${perk.name} (${perk.rarity})!`;
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

  function abilityInfos(piece: Piece): { name: string; description: string; rarity: AbilityRarity; trigger: AbilityTrigger }[] {
    return piece.mutations.map((mutationId) => {
      const def = ABILITIES[mutationId];
      return { name: def.name, description: def.description, rarity: def.rarity, trigger: def.trigger };
    });
  }

  function showSelectedPieceInfo(piece: Piece): void {
    hud.setSelectedPieceInfo({
      label: `${piece.color} ${piece.type}`,
      abilities: abilityInfos(piece),
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
    aiMutations.clear(); // each battle fields a fresh enemy army with no carried-over boons
    applyOwnedMutations();
    currentTurn = 'white';
    gameOver = false;
    clearSelection();
    boardView.syncBoard(board);
    pieceView.clear();
    pieceView.syncPieces(board.pieces);
    scene3d.worldGroup.rotation.y = humanColor === 'black' ? Math.PI : 0;
    resetView(scene3d); // snap the camera back to its home framing at the start of every battle
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
   * the battle immediately on checkmate (a win) or stalemate (a draw), per classic chess law.
   * `note` is an extra announcement (e.g. an enemy perk gain) appended to the status line. */
  async function advanceTurnAfter(moverColor: Color, note?: string | null): Promise<boolean> {
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
    const noteSuffix = note ? ` — ${note}` : '';
    if (nextColor === humanColor) {
      inputLocked = false;
      hud.setStatus(`Your move (${humanColor})${checkSuffix}${noteSuffix}`);
      updateAbilityButtons();
    } else {
      hud.setStatus(`Opponent thinking...${checkSuffix}${noteSuffix}`);
      await runAiTurn();
    }
    return false;
  }

  async function runPlayerMove(move: Move): Promise<void> {
    inputLocked = true;
    updateAbilityButtons();
    // Rate the move against every alternative BEFORE applying it — this "chess book" score
    // is the skill share (30%) of the perk-rarity roll for any capture it makes.
    const moveQuality = move.isCapture ? rateMoveQuality(board, move, humanColor) : 0.5;
    const opponentBefore = countPieces(aiColor());
    const result = applyMove(board, move);
    const ended = await resolveTurn(result);
    if (ended) return;
    tickFrozenStatuses(board, humanColor);

    const capturesTaken = opponentBefore - countPieces(aiColor());
    for (let i = 0; i < capturesTaken; i++) {
      await offerPerk(moveQuality);
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
    const moveQuality = move.isCapture ? rateMoveQuality(board, move, aiColor()) : 0.5;
    const humanBefore = countPieces(humanColor);
    const result = applyMove(board, move);
    const ended = await resolveTurn(result);
    if (ended) return;
    tickFrozenStatuses(board, aiColor());

    // The enemy earns boons by the same law the player does — one perk per piece taken.
    let perkNote: string | null = null;
    const capturesTaken = humanBefore - countPieces(humanColor);
    for (let i = 0; i < capturesTaken; i++) {
      perkNote = grantAiPerk(moveQuality) ?? perkNote;
    }
    if (perkNote) pieceView.syncPieces(board.pieces); // show the new perk gems immediately

    await advanceTurnAfter(aiColor(), perkNote);
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
      await offerPerk(0.5); // ability blasts aren't "book moves" — neutral skill share, luck decides
    }

    await advanceTurnAfter(humanColor);
  }

  async function onBattleEnd(winner: Color): Promise<void> {
    gameOver = true;
    inputLocked = true;
    hud.setAbilityButtons([]);

    if (winner === humanColor) {
      hud.setStatus('Checkmate — Victory!');
      // Checkmate is the finest move in the book — the parting draw leans generous.
      const options = pickPerkOptions(board, ownedMutations, { color: humanColor, quality: 0.9 });
      rewardScreen.show('Checkmate! Choose a parting perk:', options, (id) => {
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

  // --- Hover tooltip: point at any piece to see what it is and what its perks do ---
  const hoverRaycaster = new THREE.Raycaster();
  const hoverPointer = new THREE.Vector2();

  function pieceUnderPointer(event: PointerEvent): Piece | null {
    const rect = scene3d.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    hoverPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    hoverPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    hoverRaycaster.setFromCamera(hoverPointer, scene3d.camera);
    const hits = hoverRaycaster.intersectObjects(scene3d.pieceGroup.children, true);
    for (const hit of hits) {
      // Walk up the hierarchy: gems/frozen shells are added after ids are stamped, so the
      // id may live on an ancestor rather than the intersected mesh itself.
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        const id = obj.userData.rootPieceId as string | undefined;
        if (id) return board.pieces.find((p) => p.id === id) ?? null;
        obj = obj.parent;
      }
    }
    return null;
  }

  scene3d.renderer.domElement.addEventListener('pointermove', (event) => {
    const piece = pieceUnderPointer(event);
    if (piece) {
      hud.setPieceTooltip(
        {
          title: `${piece.color === humanColor ? 'Your' : 'Enemy'} ${piece.type}`,
          frozen: (piece.frozenTurns ?? 0) > 0,
          abilities: abilityInfos(piece),
        },
        event.clientX,
        event.clientY,
      );
      scene3d.renderer.domElement.style.cursor = 'pointer';
    } else {
      hud.setPieceTooltip(null);
      scene3d.renderer.domElement.style.cursor = '';
    }
  });
  scene3d.renderer.domElement.addEventListener('pointerleave', () => hud.setPieceTooltip(null));

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
