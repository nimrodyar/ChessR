import type { AbilityDef } from '../core/abilities';
import type { MutationId } from '../core/pieces';

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
        card.innerHTML = `
          <div class="reward-card-header">
            <span class="reward-card-class">${ability.className}</span>
            <span class="reward-card-rarity reward-card-rarity--${ability.rarity}">${ability.rarity}</span>
          </div>
          <strong>${ability.name}</strong>
          <span class="reward-card-piece">${ability.pieceType}</span>
          <span>${ability.description}</span>
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
