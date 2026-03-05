import { Component, output, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import type { TechCategory } from '../services/tech.service';

export type FilterValues = {
  search: string;
  categories: TechCategory[];
  level: string;
};

const ALL_CATEGORIES: { value: TechCategory; label: string }[] = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'infra', label: 'Infra' },
  { value: 'data', label: 'Data' },
  { value: 'mobile', label: 'Mobile' },
];

@Component({
  selector: 'app-tech-filter',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  template: `
    <form [formGroup]="form" class="tf-form" (ngSubmit)="emitFilter()">
      <div class="tf-row">
        <div class="tf-field">
          <label for="tf-search" class="tf-label">Buscar</label>
          <input
            id="tf-search"
            type="text"
            formControlName="search"
            placeholder="nome, tag, descrição..."
            class="tf-input"
            (input)="emitFilter()"
          />
        </div>

        <div class="tf-field">
          <label class="tf-label">Nível</label>
          <select formControlName="level" class="tf-select" (change)="emitFilter()">
            <option value="">Todos</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      <div class="tf-categories">
        @for (cat of allCategories; track cat.value) {
          <label class="tf-cat">
            <input
              type="checkbox"
              [value]="cat.value"
              (change)="onCategoryChange(cat.value, $event)"
              [checked]="isCategoryActive(cat.value)"
              class="tf-cat__checkbox"
            />
            <span class="tf-cat__label">{{ cat.label }}</span>
          </label>
        }
      </div>
    </form>
  `,
  styles: [`
    .tf-form { display: flex; flex-direction: column; gap: 12px; }
    .tf-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .tf-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 160px; }
    .tf-label { font-size: 0.72rem; color: var(--ds-text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }
    .tf-input, .tf-select {
      background: rgba(15,23,42,0.8);
      border: 1px solid rgba(0,229,255,0.2);
      border-radius: 6px;
      color: var(--ds-text-primary);
      padding: 6px 10px;
      font-size: 0.82rem;
      outline: none;
      transition: border-color 160ms ease;
    }
    .tf-input:focus, .tf-select:focus { border-color: var(--ds-neon); }
    .tf-select option { background: #0a0f1d; }
    .tf-categories { display: flex; gap: 8px; flex-wrap: wrap; }
    .tf-cat { display: flex; align-items: center; gap: 5px; cursor: pointer; }
    .tf-cat__checkbox { accent-color: var(--ds-neon); width: 13px; height: 13px; }
    .tf-cat__label { font-size: 0.75rem; color: var(--ds-text-secondary); transition: color 160ms; }
    .tf-cat:has(.tf-cat__checkbox:checked) .tf-cat__label { color: var(--ds-neon); }
  `]
})
export class TechFilterComponent {
  filterChange = output<FilterValues>();

  private fb = inject(FormBuilder);
  readonly allCategories = ALL_CATEGORIES;

  form: FormGroup = this.fb.group({
    search: [''],
    level: [''],
  });

  private activeCategories = new Set<TechCategory>();

  isCategoryActive(cat: TechCategory): boolean {
    return this.activeCategories.has(cat);
  }

  onCategoryChange(cat: TechCategory, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.activeCategories.add(cat);
    } else {
      this.activeCategories.delete(cat);
    }
    this.emitFilter();
  }

  emitFilter(): void {
    this.filterChange.emit({
      search: this.form.value['search'] as string,
      categories: Array.from(this.activeCategories),
      level: this.form.value['level'] as string,
    });
  }
}
