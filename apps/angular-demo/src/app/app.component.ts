import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TechFilterComponent } from './components/tech-filter.component';
import { TechListComponent } from './components/tech-list.component';
import { TechService, type Tech, type TechCategory } from './services/tech.service';
import type { FilterValues } from './components/tech-filter.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TechFilterComponent, TechListComponent],
  template: `
    <div class="app">
      <header class="app-header">
        <div class="app-header__inner">
          <h1 class="app-header__title">
            <span class="app-header__icon">🅰</span>
            Tech Stack Explorer
          </h1>
          <p class="app-header__subtitle">
            Angular 17+ · Standalone Components · Signals · Reactive Forms
          </p>
        </div>
      </header>

      <main class="app-main">
        <aside class="app-sidebar">
          <div class="app-sidebar__section">
            <div class="app-sidebar__label">Filtros</div>
            <app-tech-filter (filterChange)="onFilterChange($event)" />
          </div>

          <div class="app-sidebar__section app-sidebar__section--badges">
            <div class="app-sidebar__label">Angular Features</div>
            <div class="app-badge-list">
              @for (badge of angularBadges; track badge) {
                <span class="app-badge">{{ badge }}</span>
              }
            </div>
          </div>
        </aside>

        <section class="app-content">
          @if (loading()) {
            <div class="app-loading">Carregando tecnologias...</div>
          } @else {
            <app-tech-list [techs]="filteredTechs()" />
          }
        </section>
      </main>
    </div>
  `,
  styles: [`
    .app {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--ds-bg-deep);
    }

    .app-header {
      background: rgba(10,15,29,0.95);
      border-bottom: 1px solid rgba(0,229,255,0.12);
      padding: 20px 32px;
    }
    .app-header__inner { max-width: 1200px; margin: 0 auto; }
    .app-header__title {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--ds-neon);
      text-shadow: 0 0 12px rgba(0,229,255,0.35);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .app-header__icon { font-size: 1.2rem; }
    .app-header__subtitle {
      margin-top: 4px;
      font-size: 0.78rem;
      color: var(--ds-text-secondary);
    }

    .app-main {
      flex: 1;
      display: flex;
      gap: 24px;
      padding: 24px 32px;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }

    .app-sidebar {
      width: 260px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .app-sidebar__section {
      background: rgba(15,23,42,0.7);
      border: 1px solid rgba(0,229,255,0.1);
      border-radius: 10px;
      padding: 16px;
    }
    .app-sidebar__label {
      font-size: 0.68rem;
      color: var(--ds-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 12px;
    }

    .app-badge-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .app-badge {
      font-size: 0.65rem;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(0,229,255,0.08);
      border: 1px solid rgba(0,229,255,0.2);
      color: var(--ds-neon);
    }

    .app-content { flex: 1; min-width: 0; }

    .app-loading {
      text-align: center;
      color: var(--ds-text-secondary);
      padding: 48px 0;
    }

    @media (max-width: 640px) {
      .app-main { flex-direction: column; padding: 16px; }
      .app-sidebar { width: 100%; }
    }
  `]
})
export class AppComponent implements OnInit {
  private techService = inject(TechService);

  loading = signal(true);
  private allTechs = signal<Tech[]>([]);
  private filters = signal<FilterValues>({ search: '', categories: [], level: '' });

  readonly angularBadges = [
    'Standalone', 'Signals', 'Reactive Forms', '@for / @if',
    'inject()', 'input()', 'output()', 'computed()',
  ];

  filteredTechs = computed(() => {
    const f = this.filters();
    return this.allTechs().filter(tech => {
      if (f.search) {
        const q = f.search.toLowerCase();
        const match = tech.name.toLowerCase().includes(q) ||
          tech.description.toLowerCase().includes(q) ||
          tech.tags.some(t => t.includes(q));
        if (!match) return false;
      }
      if (f.categories.length > 0 && !f.categories.includes(tech.category as TechCategory)) {
        return false;
      }
      if (f.level && tech.level !== f.level) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.techService.getTechs().subscribe(techs => {
      this.allTechs.set(techs);
      this.loading.set(false);
    });
  }

  onFilterChange(values: FilterValues): void {
    this.filters.set(values);
  }
}
