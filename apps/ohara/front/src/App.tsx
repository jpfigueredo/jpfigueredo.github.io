import { useState } from 'react';
import { OharaHome } from './OharaHome';
import { TrailScreen } from './TrailScreen';

export default function App() {
  const [trailId, setTrailId] = useState<string | null>(null);

  return (
    <div className="ohara">
      {trailId ? (
        <TrailScreen trailId={trailId} onBack={() => setTrailId(null)} />
      ) : (
        <OharaHome onSelect={setTrailId} />
      )}
    </div>
  );
}
