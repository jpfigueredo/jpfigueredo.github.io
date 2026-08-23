import { useMemo, useState } from 'react';
import { loadTrail } from './data/loadTrail';
import { buildLayout } from './domain/graph';
import { TrailCanvas } from './components/TrailCanvas';
import { NodeModal } from './components/NodeModal';
import type { TrailNode } from './types';

export default function App() {
  const trail = useMemo(() => loadTrail(), []);
  const layout = useMemo(() => buildLayout(trail), [trail]);
  const byId = useMemo(() => new Map(trail.nodes.map((n) => [n.id, n])), [trail]);
  const [selected, setSelected] = useState<TrailNode | null>(null);

  return (
    <div className="ohara">
      <header className="app-head">
        <p className="app-head__eyebrow">Trilha de leitura · fontes primárias</p>
        <h1 className="app-head__title">{trail.trail.title}</h1>
        <p className="app-head__meta">
          {trail.nodes.length} obras · {trail.edges.length} conexões · raízes → fronteira
        </p>
      </header>

      <TrailCanvas layout={layout} onSelect={setSelected} />

      <NodeModal
        node={selected}
        trail={trail}
        onClose={() => setSelected(null)}
        onNavigate={(id) => setSelected(byId.get(id) ?? null)}
      />
    </div>
  );
}
