import { useState } from 'react';
import { OharaHome } from './OharaHome';
import { TrailScreen } from './TrailScreen';
import { TRAILS, type TrailCard } from './trails';

export default function App({ trails = TRAILS }: { trails?: TrailCard[] }) {
  const [trailId, setTrailId] = useState<string | null>(null);

  // Com uma única trilha não há o que escolher: abre direto nela, sem "voltar".
  if (trails.length === 1) {
    return (
      <div className="ohara">
        <TrailScreen trailId={trails[0].id} />
      </div>
    );
  }

  return (
    <div className="ohara">
      {trailId ? (
        <TrailScreen trailId={trailId} onBack={() => setTrailId(null)} />
      ) : (
        <OharaHome trails={trails} onSelect={setTrailId} />
      )}
    </div>
  );
}
