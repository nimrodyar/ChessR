import type { AbilityDef } from '../core/abilities';
import type { MutationId } from '../core/pieces';
import { TRIGGER_LABELS } from './hud';

export class RewardScreen {
  private overlay: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'reward-overlay';
    this.overlay.style.display = 'none';
    container.appendChild(this.overlay);
  }

  show(title: string, options: AbilityDef[], onPick: (id: MutationId) => void, onSkip: () => void): void {
    this.overlay.innerHTML = '';
    this.overlay.style.display = 'flex';

    const panel = document.createElement('div');
    panel.className = 'reward-panel';

    const heading = document.createElement('h2');
    heading.textContent = title;
    panel.appendChild(heading);

    if (options.length === 0) {
      const msg = document.createElement('p');
      msg.textContent = 'No perks remain to claim right now.';
      panel.appendChild(msg);
    } else {
      const cardRow = document.createElement('div');
      cardRow.className = 'reward-cards';
      for (const ability of options) {
        const card = document.createElement('button');
        card.className = `reward-card reward-card--${ability.rarity}`;
        // Strict card structure, top to bottom: symbol, title, use, description.
        card.innerHTML = `
          <div class="reward-card-top">
            <span class="reward-card-symbol">${ability.icon}</span>
            <span class="reward-card-rarity reward-card-rarity--${ability.rarity}">${ability.rarity}</span>
          </div>
          <strong class="reward-card-title">${ability.name}</strong>
          <div class="reward-card-use">
            <span class="trigger-chip trigger-chip--${ability.trigger}">${TRIGGER_LABELS[ability.trigger]}</span>
          </div>
          <span class="reward-card-desc">${ability.description}</span>
        `;
        card.onclick = () => {
          this.hide();
          onPick(ability.id);
        };
        cardRow.appendChild(card);
      }
      panel.appendChild(cardRow);
    }

    const skipBtn = document.createElement('button');
    skipBtn.className = 'hud-button';
    skipBtn.textContent = options.length === 0 ? 'Continue' : 'Skip';
    skipBtn.onclick = () => {
      this.hide();
      onSkip();
    };
    panel.appendChild(skipBtn);

    this.overlay.appendChild(panel);
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }
}
