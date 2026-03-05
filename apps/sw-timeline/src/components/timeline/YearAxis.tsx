import React from 'react';
import type { TimelineEvent } from '../../data/events';

type Props = {
  events: TimelineEvent[];
  selectedEvent: TimelineEvent | null;
  onSelectEvent: (ev: TimelineEvent | null) => void;
};

export const YearAxis: React.FC<Props> = ({ events, selectedEvent, onSelectEvent }) => {
  const years = React.useMemo(
    () => Array.from(new Set(events.map((e) => e.year))).sort((a, b) => a - b),
    [events]
  );

  // Flat ordered list of events for keyboard nav
  const flatEvents = React.useMemo(
    () => years.flatMap((year) => events.filter((e) => e.year === year)),
    [years, events]
  );

  const dotRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleKeyDown = (e: React.KeyboardEvent, currentId: string) => {
    const idx = flatEvents.findIndex((ev) => ev.id === currentId);
    if (idx === -1) return;

    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = Math.min(idx + 1, flatEvents.length - 1);
    if (e.key === 'ArrowLeft') nextIdx = Math.max(idx - 1, 0);

    if (nextIdx !== null && nextIdx !== idx) {
      e.preventDefault();
      const nextId = flatEvents[nextIdx].id;
      dotRefs.current.get(nextId)?.focus();
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const ev = flatEvents[idx];
      onSelectEvent(selectedEvent?.id === ev.id ? null : ev);
    }

    if (e.key === 'Escape') {
      onSelectEvent(null);
    }
  };

  return (
    <div className="sw-axis" role="region" aria-label="Linha do tempo">
      <div className="sw-axis__track">
        {years.map((year) => (
          <div key={year} className="sw-axis__year-group">
            <div className="sw-axis__year-marker">
              <div className="sw-axis__year-tick" aria-hidden="true" />
              <div className="sw-axis__year-label">{year}</div>
            </div>
            <div className="sw-axis__events-row">
              {events
                .filter((ev) => ev.year === year)
                .map((ev) => {
                  const isSelected = selectedEvent?.id === ev.id;
                  return (
                    <button
                      key={ev.id}
                      ref={(el) => {
                        if (el) dotRefs.current.set(ev.id, el);
                        else dotRefs.current.delete(ev.id);
                      }}
                      type="button"
                      className={
                        'sw-axis__event-dot' + (isSelected ? ' sw-axis__event-dot--selected' : '')
                      }
                      onClick={() => onSelectEvent(isSelected ? null : ev)}
                      onKeyDown={(e) => handleKeyDown(e, ev.id)}
                      aria-pressed={isSelected}
                      aria-label={`${ev.title} (${ev.year})`}
                    >
                      <span className="sw-axis__event-title">{ev.title}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
