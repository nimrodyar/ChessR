export interface AbilityButtonSpec {
  id: string;
  label: string;
  onClick: () => void;
}

export interface HudCallbacks {
  onRestart: () => void;
  onToggleViewLock: () => void;
}

export class Hud {
  private statusEl: HTMLDivElement;
  private abilityRow: HTMLDivElement;
  private lockBtn: HTMLButtonElement;

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

    const restartBtn = document.createElement('button');
    restartBtn.textContent = 'Restart Battle';
    restartBtn.className = 'hud-button';
    restartBtn.onclick = () => callbacks.onRestart();
    buttonRow.appendChild(restartBtn);

    root.appendChild(buttonRow);
    container.appendChild(root);
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
