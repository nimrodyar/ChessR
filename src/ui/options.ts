import type { ViewPreset } from '../render/three/scene3d';

export interface GameSettings {
  sfxEnabled: boolean;
  sfxVolume: number; // 0..1
  graphics: 'high' | 'low';
  view: ViewPreset;
}

export const DEFAULT_SETTINGS: GameSettings = {
  sfxEnabled: true,
  sfxVolume: 0.8,
  graphics: 'high',
  view: '3d',
};

const STORAGE_KEY = 'chess-rogue-settings';

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or blocked storage — settings just won't persist.
  }
}

/** Options overlay: SFX, graphics quality, and camera view. Changes apply live via onChange. */
export class OptionsMenu {
  private overlay: HTMLDivElement;
  private settings: GameSettings;
  private onChange: (settings: GameSettings) => void;

  constructor(container: HTMLElement, settings: GameSettings, onChange: (settings: GameSettings) => void) {
    this.settings = settings;
    this.onChange = onChange;
    this.overlay = document.createElement('div');
    this.overlay.className = 'reward-overlay';
    this.overlay.style.display = 'none';
    container.appendChild(this.overlay);
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
  }

  show(): void {
    this.render();
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }

  private apply(patch: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this.onChange(this.settings);
    this.render(); // refresh active-state styling
  }

  private render(): void {
    this.overlay.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'reward-panel options-panel';

    const heading = document.createElement('h2');
    heading.textContent = 'Options';
    panel.appendChild(heading);

    panel.appendChild(this.rowToggle('Sound Effects', this.settings.sfxEnabled, (on) => this.apply({ sfxEnabled: on })));
    panel.appendChild(
      this.rowSlider('Volume', this.settings.sfxVolume, (v) => this.apply({ sfxVolume: v })),
    );
    panel.appendChild(
      this.rowChoices('Graphics', [
        { id: 'high', label: 'High' },
        { id: 'low', label: 'Low' },
      ], this.settings.graphics, (id) => this.apply({ graphics: id as GameSettings['graphics'] })),
    );
    panel.appendChild(
      this.rowChoices('View', [
        { id: '3d', label: 'Classic 3D' },
        { id: 'top', label: 'Top-Down 2D' },
        { id: 'fp', label: 'First Person' },
      ], this.settings.view, (id) => this.apply({ view: id as ViewPreset })),
    );

    const closeBtn = document.createElement('button');
    closeBtn.className = 'hud-button';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => this.hide();
    panel.appendChild(closeBtn);

    this.overlay.appendChild(panel);
  }

  private rowToggle(label: string, value: boolean, onSet: (v: boolean) => void): HTMLDivElement {
    const row = this.row(label);
    const btn = document.createElement('button');
    btn.className = `hud-button options-toggle${value ? ' options-active' : ''}`;
    btn.textContent = value ? 'On' : 'Off';
    btn.onclick = () => onSet(!value);
    row.appendChild(btn);
    return row;
  }

  private rowSlider(label: string, value: number, onSet: (v: number) => void): HTMLDivElement {
    const row = this.row(label);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(value * 100));
    slider.className = 'options-slider';
    slider.oninput = () => onSet(Number(slider.value) / 100);
    row.appendChild(slider);
    return row;
  }

  private rowChoices(
    label: string,
    choices: { id: string; label: string }[],
    active: string,
    onSet: (id: string) => void,
  ): HTMLDivElement {
    const row = this.row(label);
    const group = document.createElement('div');
    group.className = 'options-choices';
    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.className = `hud-button${choice.id === active ? ' options-active' : ''}`;
      btn.textContent = choice.label;
      btn.onclick = () => onSet(choice.id);
      group.appendChild(btn);
    }
    row.appendChild(group);
    return row;
  }

  private row(label: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'options-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'options-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);
    return row;
  }
}
