import type { AbilityRarity } from '../core/abilities';

export interface AbilityButtonSpec {
  id: string;
  label: string;
  onClick: () => void;
}

export interface HudCallbacks {
  onRestart: () => void;
  onToggleViewLock: () => void;
  onResetView: () => void;
}

export interface SelectedPieceInfo {
  label: string;
  abilities: { name: string; description: string; rarity: AbilityRarity }[];
}

export class Hud {
  private statusEl: HTMLDivElement;
  private abilityRow: HTMLDivElement;
  private lockBtn: HTMLButtonElement;
  private pieceInfoEl: HTMLDivElement;

  constructor(container: HTMLElement, callbacks: HudCallbacks) {
    const root = document.createElement('div');
    root.className = 'hud';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'hud-status';
    root.appendChild(this.statusEl);

    this.abilityRow = document.createElement('div');
    this.abilityRow.className = 'hud-buttons';
    root.appendChild(this.abilityRow);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'hud-buttons';

    this.lockBtn = document.createElement('button');
    this.lockBtn.textContent = 'Lock View';
    this.lockBtn.className = 'hud-button';
    this.lockBtn.onclick = () => callbacks.onToggleViewLock();
    buttonRow.appendChild(this.lockBtn);

    const resetViewBtn = document.createElement('button');
    resetViewBtn.textContent = 'Reset View';
    resetViewBtn.className = 'hud-button';
    resetViewBtn.onclick = () => callbacks.onResetView();
    buttonRow.appendChild(resetViewBtn);

    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Restart Battle';
    restartBtn.className = 'hud-button';
    restartBtn.onclick = () => callbacks.onRestart();
    buttonRow.appendChild(restartBtn);

    root.appendChild(buttonRow);
    container.appendChild(root);

    this.pieceInfoEl = document.createElement('div');
    this.pieceInfoEl.className = 'piece-info-panel';
    this.pieceInfoEl.style.display = 'none';
    container.appendChild(this.pieceInfoEl);
  }

  setSelectedPieceInfo(info: SelectedPieceInfo | null): void {
    if (!info) {
      this.pieceInfoEl.style.display = 'none';
      this.pieceInfoEl.innerHTML = '';
      return;
    }
    this.pieceInfoEl.style.display = 'flex';
    const abilityHtml =
      info.abilities.length === 0
        ? '<div class="piece-info-empty">No perks granted yet</div>'
        : info.abilities
            .map(
              (a) => `
          <div class="piece-info-ability piece-info-ability--${a.rarity}">
            <div class="piece-info-ability-name">${a.name}</div>
            <div class="piece-info-ability-desc">${a.description}</div>
          </div>`,
            )
            .join('');
    this.pieceInfoEl.innerHTML = `<div class="piece-info-title">${info.label}</div>${abilityHtml}`;
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  setAbilityButtons(buttons: AbilityButtonSpec[]): void {
    this.abilityRow.innerHTML = '';
    for (const spec of buttons) {
      const btn = document.createElement('button');
      btn.textContent = spec.label;
      btn.className = 'hud-button hud-button-ability';
      btn.onclick = () => spec.onClick();
      this.abilityRow.appendChild(btn);
    }
  }

  setViewLocked(locked: boolean): void {
    this.lockBtn.textContent = locked ? 'Unlock View' : 'Lock View';
  }
}
