import React from 'react';
import { YearAxis } from '../timeline/YearAxis';
import { FiltersBar } from '../timeline/FiltersBar';
import { EventDetailsPanel } from '../timeline/EventDetailsPanel';
import { TimelineEvent, sampleEvents } from '../../data/events';

export const TimelineShell: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = React.useState<TimelineEvent | null>(null);
  const [activeTags, setActiveTags] = React.useState<string[]>([]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const visibleEvents = activeTags.length
    ? sampleEvents.filter((e) => e.theoryTags.some((t) => activeTags.includes(t)))
    : sampleEvents;

  return (
    <div className="sw-shell">
      <header className="sw-shell__header">
        <div className="sw-shell__title">
          <h1>SW Timeline</h1>
          <p>Guia de estudo da história das teorias de TI – beta</p>
        </div>
      </header>

      <div className="sw-shell__body">
        <aside className="sw-shell__sidebar">
          <FiltersBar activeTags={activeTags} onToggleTag={toggleTag} />
        </aside>

        <main className="sw-shell__main">
          <YearAxis
            events={visibleEvents}
            selectedEvent={selectedEvent}
            onSelectEvent={setSelectedEvent}
          />
        </main>

        <aside className="sw-shell__details">
          <EventDetailsPanel key={selectedEvent?.id ?? 'empty'} event={selectedEvent} />
        </aside>
      </div>
    </div>
  );
};

