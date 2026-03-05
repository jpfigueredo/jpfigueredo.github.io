import React from 'react';
import type { TimelineEvent } from '../../data/events';

type Props = {
  event: TimelineEvent | null;
};

export const EventDetailsPanel: React.FC<Props> = ({ event }) => {
  if (!event) {
    return (
      <div className="sw-details sw-details--empty">
        <p>Selecione um ponto na linha do tempo para ver detalhes.</p>
      </div>
    );
  }

  return (
    <div className="sw-details sw-details--visible">
      <h2 className="sw-details__title">
        {event.title}
        <span className="sw-details__year"> ({event.year})</span>
      </h2>
      <p className="sw-details__summary">{event.shortDescription}</p>

      {event.theoryTags.length > 0 && (
        <div className="sw-details__tags">
          {event.theoryTags.map((tag) => (
            <span key={tag} className="sw-details__tag">{tag}</span>
          ))}
        </div>
      )}

      <section className="sw-details__section">
        <h3>Leitura materialista</h3>
        <p className="sw-details__marxist">{event.marxistAnalysis}</p>
      </section>

      {event.sources.length > 0 && (
        <section className="sw-details__section">
          <h3>Fontes</h3>
          <ul className="sw-details__sources">
            {event.sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noreferrer">
                  {src.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
