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

// ---------------------------------------------------------------------------
// Casos adicionados pelo QA (issue jpfigueredo/ohara#3).
// ---------------------------------------------------------------------------

// Todo seed.*.json no disco, nas duas pastas onde o seed mora. Só os caminhos
// (glob preguiçoso): serve para provar que nenhum seed fica de fora de SEEDS.
const SEEDS_NO_DISCO = [
  ...Object.keys(import.meta.glob('../../../../web/src/data/ohara/seed.*.json')).map((p) =>
    p.replace('../../../../', ''),
  ),
  ...Object.keys(import.meta.glob('./data/seed.*.json')).map((p) =>
    p.replace('./', 'apps/ohara/front/src/'),
  ),
];

type Seed = { nodes: { explainers?: unknown[] }[] };

// Garante que o seed foi rejeitado por causa do explicador, e não por outro motivo.
const errosForaDoExplicador = () =>
  (validate.errors ?? []).filter((e) => !e.instancePath.startsWith('/nodes/0/explainers'));

describe('schema do seed (ajv): guardas contra teste que passa vazio', () => {
  it('SEEDS lista exatamente os seeds que existem no disco', () => {
    // Se um seed deixar de ser importado (ou um novo for criado sem entrar em SEEDS),
    // o it.each acima roda menos casos e continua verde. Este teste pega isso.
    expect(SEEDS_NO_DISCO.length).toBeGreaterThanOrEqual(2);
    expect(SEEDS.map(([path]) => path).sort()).toEqual([...SEEDS_NO_DISCO].sort());
  });

  it.each(SEEDS)('%s não está truncado (≥ 26 nós, critério da issue #3)', (_path, seed) => {
    // 26 é o tamanho da trilha no critério de aceite; se a trilha crescer, continua valendo.
    expect((seed as Seed).nodes.length).toBeGreaterThanOrEqual(26);
  });

  it.each(SEEDS)('%s exercita $defs/explainer (tem nó com explicadores)', (_path, seed) => {
    // Sem isso, apagar os explicadores do seed deixaria o teste de validação verde
    // sem nunca passar pela definição nova.
    const comExplicador = (seed as Seed).nodes.filter((n) => (n.explainers ?? []).length > 0);
    expect(comExplicador.length).toBeGreaterThan(0);
  });
});

describe('schema do seed (ajv): explicadores aceitos', () => {
  it('aceita explainers: []', () => {
    const seed = validSeed();
    seed.nodes[0].explainers = [];
    expect(validate(seed)).toBe(true);
  });

  it('aceita nó sem explainers (campo opcional)', () => {
    const seed = validSeed();
    const node = seed.nodes.find((n) => n.explainers !== undefined);
    expect(node).toBeDefined();
    delete node!.explainers;
    expect(validate(seed)).toBe(true);
  });

  it.each(['article', 'video', 'book', 'course', 'interactive'])('aceita kind %s', (kind) => {
    expect(validate(withExplainer({ ...freeExplainer, kind }))).toBe(true);
  });

  it.each([
    ['retail com url', { label: 'L', kind: 'book', sourceType: 'retail', url: 'https://example.org/l' }],
    ['preview-embed com url', { label: 'L', kind: 'book', sourceType: 'preview-embed', url: 'https://example.org/l' }],
    ['free com url e query', { ...freeExplainer, query: 'termo de busca' }],
    ['todos os opcionais preenchidos', { ...freeExplainer, author: 'A', provider: 'P', query: 'Q', note: 'N' }],
    ['opcionais como string vazia', { ...freeExplainer, author: '', provider: '', note: '' }],
    ['unicode no label, author e note', {
      ...freeExplainer,
      label: 'Relógios lógicos — 時間と順序 🕰️',
      author: 'Ægir Ñúñez',
      note: 'ação, ordenação, über',
    }],
    ['url com acento codificado (%C3%B3)', { ...freeExplainer, url: 'https://pt.wikipedia.org/wiki/Rel%C3%B3gio_de_Lamport' }],
  ])('aceita explicador: %s', (_caso, explainer) => {
    const ok = validate(withExplainer(explainer));
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe('schema do seed (ajv): explicadores rejeitados', () => {
  it.each([
    ['explainers não é array', {}],
    ['explicador null', [null]],
    ['explicador sem kind', [{ label: 'X', sourceType: 'free', url: 'https://example.org/' }]],
    ['explicador sem sourceType', [{ label: 'X', kind: 'video', url: 'https://example.org/' }]],
    ['label não é string', [{ ...freeExplainer, label: 42 }]],
    ['free só com query (sem url)', [{ label: 'X', kind: 'article', sourceType: 'free', query: 'q' }]],
    ['free com url vazia', [{ ...freeExplainer, url: '' }]],
    ['retail com url vazia', [{ label: 'X', kind: 'book', sourceType: 'retail', url: '' }]],
    ['url relativa', [{ ...freeExplainer, url: '/caminho/relativo' }]],
    ['url com acento não codificado', [{ ...freeExplainer, url: 'https://pt.wikipedia.org/wiki/Relógio_de_Lamport' }]],
    ['segundo explicador inválido depois de um válido', [freeExplainer, { ...freeExplainer, kind: 'podcast' }]],
  ])('rejeita seed inválido: %s', (_caso, explainers) => {
    const seed = validSeed();
    seed.nodes[0].explainers = explainers as unknown[];
    expect(validate(seed)).toBe(false);
    expect(errosForaDoExplicador()).toEqual([]);
  });

  it('rejeita explicador inválido em nó que não é o primeiro', () => {
    const seed = validSeed();
    const ultimo = seed.nodes.length - 1;
    seed.nodes[ultimo].explainers = [{ ...freeExplainer, kind: 'podcast' }];
    expect(validate(seed)).toBe(false);
    expect(validate.errors?.[0]?.instancePath).toBe(`/nodes/${ultimo}/explainers/0/kind`);
  });
});

// Achados do QA para o dev: o schema hoje ACEITA estes explicadores, mas o NodeModal
// renderiza um cartão sem botão (sem url e sem query úteis) ou um link perigoso.
// `it.fails` = passa enquanto o defeito existir; quando o schema for corrigido, o teste
// passa a falhar e o `.fails` deve ser removido. Se a decisão for manter o comportamento,
// apague o caso correspondente.
describe('schema do seed (ajv): achados do QA (comportamento desejado, ainda não implementado)', () => {
  it.fails.each([
    ['retail sem url e sem query (cartão sem botão no modal)', { label: 'X', kind: 'book', sourceType: 'retail' }],
    ['preview-embed sem url e sem query (cartão sem botão)', { label: 'X', kind: 'book', sourceType: 'preview-embed' }],
    ['retail com query vazia e sem url (cartão sem botão)', { label: 'X', kind: 'book', sourceType: 'retail', query: '' }],
    ['label vazio (cartão sem título)', { ...freeExplainer, label: '' }],
    ['url com esquema javascript: (link executável no modal)', { ...freeExplainer, url: 'javascript:alert(1)' }],
  ])('deveria rejeitar: %s', (_caso, explainer) => {
    expect(validate(withExplainer(explainer))).toBe(false);
  });
});
