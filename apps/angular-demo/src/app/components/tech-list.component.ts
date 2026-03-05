import { Component, input, computed } from '@angular/core';
import type { Tech } from '../services/tech.service';

const LEVEL_COLOR: Record<Tech['level'], string> = {
  beginner: '#7cff01',
  intermediate: 'var(--ds-neon)',
  advanced: 'var(--ds-magenta)',
};

const CATEGORY_ICON: Record<string, string> = {
  frontend: '🖥',
  backend: '⚙️',
  infra: '☁️',
  data: '📊',
  mobile: '📱',
};

@Component({
  selector: 'app-tech-list',
  standalone: true,
  template: `
    @if (techs().length === 0) {
      <div class="tl-empty">Nenhuma tecnologia encontrada com os filtros atuais.</div>
    } @else {
      <div class="tl-grid">
        @for (tech of techs(); track tech.id) {
          <article class="tl-card" [attr.data-category]="tech.category">
            <div class="tl-card__header">
              <span class="tl-card__icon">{{ tech.icon }}</span>
              <div>
                <div class="tl-card__name">{{ tech.name }}</div>
                <div class="tl-card__meta">
                  <span class="tl-card__category">{{ categoryIcon(tech.category) }} {{ tech.category }}</span>
                  <span class="tl-card__level" [style.color]="levelColor(tech.level)">
                    {{ tech.level }}
                  </span>
                </div>
              </div>
            </div>
            <p class="tl-card__desc">{{ tech.description }}</p>
            <div class="tl-card__tags">
              @for (tag of tech.tags; track tag) {
                <span class="tl-card__tag">#{{ tag }}</span>
              }
            </div>
          </article>
        }
      </div>
      <div class="tl-count">{{ techs().length }} tecnologia(s) encontrada(s)</div>
    }
  `,
  styles: [`
    .tl-empty {
      text-align: center;
      color: var(--ds-text-secondary);
      padding: 48px 0;
      font-size: 0.9rem;
    }
    .tl-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
    .tl-card {
      background: var(--ds-bg-card);
      border: 1px solid rgba(0,229,255,0.15);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: border-color 200ms ease, box-shadow 200ms ease;
    }
    .tl-card:hover {
      border-color: var(--ds-neon);
      box-shadow: 0 0 16px rgba(0,229,255,0.12);
    }
    .tl-card__header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .tl-card__icon { font-size: 1.6rem; line-height: 1; }
    .tl-card__name { font-size: 0.95rem; font-weight: 600; color: var(--ds-text-primary); }
    .tl-card__meta { display: flex; gap: 8px; align-items: center; margin-top: 2px; }
    .tl-card__category { font-size: 0.68rem; color: var(--ds-text-secondary); }
    .tl-card__level { font-size: 0.68rem; font-weight: 600; }
    .tl-card__desc { font-size: 0.78rem; color: var(--ds-text-secondary); line-height: 1.5; }
    .tl-card__tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .tl-card__tag {
      font-size: 0.65rem;
      color: rgba(0,229,255,0.55);
      background: rgba(0,229,255,0.07);
      border-radius: 4px;
      padding: 1px 6px;
    }
    .tl-count {
      margin-top: 12px;
      font-size: 0.72rem;
      color: var(--ds-text-secondary);
      text-align: right;
    }
  `]
})
export class TechListComponent {
  techs = input.required<Tech[]>();

  levelColor(level: Tech['level']): string { return LEVEL_COLOR[level]; }
  categoryIcon(cat: string): string { return CATEGORY_ICON[cat] ?? '•'; }
}
