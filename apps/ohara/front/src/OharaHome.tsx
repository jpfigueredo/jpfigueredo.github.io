import type { TrailCard } from './trails';

export function OharaHome({ trails, onSelect }: { trails: TrailCard[]; onSelect: (id: string) => void }) {
  return (
    <div className="home">
      <header className="home__head">
        <p className="home__eyebrow">Ohara · trilhas de leitura sobre obras de referência</p>
        <h1 className="home__title">Escolha sua trilha</h1>
        <p className="home__lede">Caminhos de estudo pela linhagem das ideias, da raiz à fronteira.</p>
      </header>

      <div className="home__grid">
        {trails.map((t) => (
          <button key={t.id} type="button" className="trail-card trail-card--active" onClick={() => onSelect(t.id)}>
            <span className="trail-card__title">{t.title}</span>
            {t.subtitle ? <span className="trail-card__sub">{t.subtitle}</span> : null}
            <span className="trail-card__go">abrir →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
