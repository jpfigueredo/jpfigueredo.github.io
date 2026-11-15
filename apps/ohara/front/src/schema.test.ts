import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
// O schema mora em web/ (contrato publicado); os seeds são validados contra ele.
import schema from '../../../../web/src/data/ohara/schema.json';
import webSeed from '../../../../web/src/data/ohara/seed.distributed-systems.json';
import appSeed from './data/seed.distributed-systems.json';

const SEEDS: [string, unknown][] = [
  ['web/src/data/ohara/seed.distributed-systems.json', webSeed],
  ['apps/ohara/front/src/data/seed.distributed-systems.json', appSeed],
];

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const validSeed = () => structuredClone(webSeed) as { nodes: Record<string, unknown>[] };
const withExplainer = (explainer: Record<string, unknown>) => {
  const seed = validSeed();
  seed.nodes[0].explainers = [explainer];
  return seed;
};
const freeExplainer = {
  label: 'Explicador',
  kind: 'article',
  sourceType: 'free',
  url: 'https://example.org/',
};

describe('schema do seed (ajv)', () => {
  it.each(SEEDS)('%s valida contra o schema', (_path, seed) => {
    const ok = validate(seed);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('aceita explicador retail com query (sem url)', () => {
    const seed = withExplainer({
      label: 'Livro',
      kind: 'book',
      sourceType: 'retail',
      provider: 'amazon',
      query: 'livro autor',
    });
    expect(validate(seed)).toBe(true);
  });

  it.each([
    ['campo desconhecido no explicador', { ...freeExplainer, extra: 1 }],
    ['kind fora do enum', { ...freeExplainer, kind: 'podcast' }],
    ['sourceType fora do enum', { ...freeExplainer, sourceType: 'pirata' }],
    ['explicador livre sem url', { label: 'X', kind: 'video', sourceType: 'free' }],
    ['explicador sem label', { kind: 'video', sourceType: 'free', url: 'https://example.org/' }],
    ['url que não é URI', { ...freeExplainer, url: 'não é uri' }],
  ])('rejeita seed inválido: %s', (_caso, explainer) => {
    expect(validate(withExplainer(explainer))).toBe(false);
  });

  it('rejeita seed inválido: campo desconhecido no nó', () => {
    const seed = validSeed();
    seed.nodes[0].ownership = 'owned';
    expect(validate(seed)).toBe(false);
  });
});
