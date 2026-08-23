interface TrailCard {
  id: string;
  title: string;
  subtitle?: string;
  status: 'active' | 'soon';
}

// Catálogo de trilhas. Só arquitetura ativa por ora; as demais são placeholders.
const TRAILS: TrailCard[] = [
  {
    id: 'distributed-systems-architecture',
    title: 'Arquitetura de Software',
    subtitle: 'De Turing a Newman · 26 fontes primárias',
    status: 'active',
  },
  { id: 'backend', title: 'Backend Developer', status: 'soon' },
  { id: 'devops', title: 'DevOps Engineer', status: 'soon' },
  { id: 'cloud', title: 'Cloud Architect', status: 'soon' },
];

export function OharaHome({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="home">
      <header className="home__head">
        <p className="home__eyebrow">Ohara · trilhas de leitura sobre fontes primárias</p>
        <h1 className="home__title">Escolha sua trilha</h1>
        <p className="home__lede">
          Caminhos de estudo derivados do grafo de citações — da raiz à fronteira, não por cargo de mercado.
        </p>
      </header>

      <div className="home__grid">
        {TRAILS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`trail-card trail-card--${t.status}`}
            disabled={t.status !== 'active'}
            onClick={() => t.status === 'active' && onSelect(t.id)}
          >
            <span className="trail-card__title">{t.title}</span>
            {t.subtitle ? <span className="trail-card__sub">{t.subtitle}</span> : null}
            {t.status === 'soon' ? (
              <span className="trail-card__badge">em breve</span>
            ) : (
              <span className="trail-card__go">abrir →</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
