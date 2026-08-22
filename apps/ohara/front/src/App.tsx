import trailData from './data/seed.distributed-systems.json';
import type { Trail } from './types';
import { TrailView } from './TrailView';

// Modo público = dado estático empacotado (sem backend, sem LLM). Depois a api/bff
// serve trilhas dinâmicas; por ora, import direto do JSON verificado.
const trail = trailData as unknown as Trail;

export default function App() {
  return (
    <div className="ohara">
      <TrailView trail={trail} />
    </div>
  );
}
