import React from 'react';

export const TIMELINE_TAGS = ['theory', 'computation', 'industry', 'open-source', 'commons', 'saas', 'ai'] as const;
export type TimelineTag = (typeof TIMELINE_TAGS)[number];

type Props = {
  activeTags: string[];
  onToggleTag: (tag: string) => void;
};

export const FiltersBar: React.FC<Props> = ({ activeTags, onToggleTag }) => (
  <div className="sw-filters">
    <h2 className="sw-filters__title">Filtros</h2>
    <p className="sw-filters__hint">
      {activeTags.length === 0 ? 'Todos os eventos' : `${activeTags.length} filtro(s) ativo(s)`}
    </p>
    <div className="sw-filters__tags">
      {TIMELINE_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          className={'sw-filters__tag' + (activeTags.includes(tag) ? ' sw-filters__tag--active' : '')}
          onClick={() => onToggleTag(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  </div>
);

