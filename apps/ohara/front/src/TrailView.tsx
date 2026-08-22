import type { Trail } from './types';
import { TrailNodeCard } from './TrailNode';

export function TrailView({ trail }: { trail: Trail }) {
  return (
    <section className="trail">
      <header className="trail__head">
        <p className="trail__eyebrow">Trilha de leitura · fontes primárias</p>
        <h1 className="trail__title">{trail.trail.title}</h1>
        <p className="trail__meta">
          {trail.nodes.length} obras · {trail.edges.length} conexões
        </p>
      </header>
      <ol className="trail__nodes">
        {trail.nodes.map((node) => (
          <TrailNodeCard key={node.id} node={node} />
        ))}
      </ol>
    </section>
  );
}
