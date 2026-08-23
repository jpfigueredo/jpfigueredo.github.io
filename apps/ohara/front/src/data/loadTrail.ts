import type { Trail } from '../types';
import { config } from '../config';
import staticTrail from './seed.distributed-systems.json';

/**
 * Fonte da trilha, resolvida por config. Hoje: import estático (modo público =
 * bundle, sem backend). Amanhã: fetch da API (modo dinâmico / local).
 */
export function loadTrail(): Trail {
  const src = config.dataSource;
  if (src.kind === 'static') {
    return staticTrail as unknown as Trail;
  }
  // TODO(api): const r = await fetch(`${src.baseUrl}/trails/${src.trailId}`)
  throw new Error(`dataSource '${src.kind}' ainda não implementado`);
}
