export interface HudCallbacks {
  onRestart: () => void;
  onActivateAbility: () => void;
}

export class Hud {
  private statusEl: HTMLDivElement;
  private abilityBtn: HTMLButtonElement;

  constructor(container: HTMLElement, callbacks: HudCallbacks) {
    const root = document.createElement('div');
    root.className = 'hud';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'hud-status';
    root.appendChild(this.statusEl);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'hud-buttons';

    this.abilityBtn = document.createElement('button');
    this.abilityBtn.textContent = 'Activate Earthquake';
    this.abilityBtn.className = 'hud-button hud-button-ability';
    this.abilityBtn.style.display = 'none';
    this.abilityBtn.onclick = () => callbacks.onActivateAbility();
    buttonRow.appendChild(this.abilityBtn);

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

  setAbilityAvailable(available: boolean): void {
    this.abilityBtn.style.display = available ? 'inline-block' : 'none';
  }
}
