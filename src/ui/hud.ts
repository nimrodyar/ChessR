import type { AbilityRarity, AbilityTrigger } from '../core/abilities';

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

export interface AbilityInfo {
  name: string;
  description: string;
  rarity: AbilityRarity;
  trigger: AbilityTrigger;
  icon: string;
}

export interface SelectedPieceInfo {
  label: string;
  abilities: AbilityInfo[];
}

export interface PieceTooltipInfo {
  title: string;
  frozen: boolean;
  abilities: AbilityInfo[];
}

/** Plain-language labels (with a scannable symbol) for when each perk actually fires —
 * shown as chips everywhere a perk is described. */
export const TRIGGER_LABELS: Record<AbilityTrigger, string> = {
  onDeath: '⚰ on death',
  onCapture: '⚔ on capture',
  activated: '✦ once per battle',
};

export function abilityEntryHtml(a: AbilityInfo): string {
  return `
    <div class="piece-info-ability piece-info-ability--${a.rarity}">
      <div class="piece-info-ability-head">
        <span class="piece-info-ability-name">${a.icon} ${a.name}</span>
        <span class="trigger-chip trigger-chip--${a.trigger}">${TRIGGER_LABELS[a.trigger]}</span>
      </div>
      <div class="piece-info-ability-desc">${a.description}</div>
    </div>`;
}

export class Hud {
  private statusEl: HTMLDivElement;
  private abilityRow: HTMLDivElement;
  private lockBtn: HTMLButtonElement;
  private pieceInfoEl: HTMLDivElement;
  private tooltipEl: HTMLDivElement;

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

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'piece-tooltip';
    this.tooltipEl.style.display = 'none';
    container.appendChild(this.tooltipEl);
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
        : info.abilities.map(abilityEntryHtml).join('');
    this.pieceInfoEl.innerHTML = `<div class="piece-info-title">${info.label}</div>${abilityHtml}`;
  }

  /** Floating hover card that follows the cursor, explaining the hovered piece's perks. */
  setPieceTooltip(info: PieceTooltipInfo | null, clientX = 0, clientY = 0): void {
    if (!info) {
      this.tooltipEl.style.display = 'none';
      return;
    }
    const frozenHtml = info.frozen ? '<div class="piece-tooltip-frozen">❄ Frozen — cannot move this turn</div>' : '';
    const abilityHtml =
      info.abilities.length === 0
        ? '<div class="piece-info-empty">No perks</div>'
        : info.abilities.map(abilityEntryHtml).join('');
    this.tooltipEl.innerHTML = `<div class="piece-info-title">${info.title}</div>${frozenHtml}${abilityHtml}`;
    this.tooltipEl.style.display = 'flex';

    // Position beside the cursor, flipping to keep the card fully on screen.
    const pad = 14;
    const rect = this.tooltipEl.getBoundingClientRect();
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + rect.width > window.innerWidth - 8) x = clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = clientY - rect.height - pad;
    this.tooltipEl.style.left = `${Math.max(8, x)}px`;
    this.tooltipEl.style.top = `${Math.max(8, y)}px`;
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
