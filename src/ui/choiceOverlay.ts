export interface ChoiceOption<T> {
  id: T;
  label: string;
  description?: string;
}

/** Generic reward-styled overlay for picking one of a small set of options — used for the
 * pre-battle color choice and for pawn promotion, so neither needs its own bespoke markup. */
export class ChoiceOverlay<T> {
  private overlay: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'reward-overlay';
    this.overlay.style.display = 'none';
    container.appendChild(this.overlay);
  }

  show(title: string, subtitle: string | null, options: ChoiceOption<T>[], onPick: (id: T) => void): void {
    this.overlay.innerHTML = '';
    this.overlay.style.display = 'flex';

    const panel = document.createElement('div');
    panel.className = 'reward-panel';

    const heading = document.createElement('h2');
    heading.textContent = title;
    panel.appendChild(heading);

    if (subtitle) {
      const sub = document.createElement('p');
      sub.textContent = subtitle;
      panel.appendChild(sub);
    }

    const row = document.createElement('div');
    row.className = 'reward-cards';
    for (const option of options) {
      const card = document.createElement('button');
      card.className = 'reward-card choice-card';
      card.innerHTML = `<strong>${option.label}</strong>${option.description ? `<span>${option.description}</span>` : ''}`;
      card.onclick = () => {
        this.hide();
        onPick(option.id);
      };
      row.appendChild(card);
    }
    panel.appendChild(row);
    this.overlay.appendChild(panel);
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }
}
