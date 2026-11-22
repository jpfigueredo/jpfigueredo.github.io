/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
// Seed e schema têm uma cópia só, no pacote @jpfig/ohara-data (packages/ohara-data).
import schema from '@jpfig/ohara-data/schema.json';
import seedDistributedSystems from '@jpfig/ohara-data/seed.distributed-systems.json';

const SEEDS: [string, unknown][] = [
  ['packages/ohara-data/seed.distributed-systems.json', seedDistributedSystems],
];

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const validSeed = () => structuredClone(seedDistributedSystems) as { nodes: Record<string, unknown>[] };
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

const PASTA_CANONICA = 'packages/ohara-data';
// Chave do glob (relativa a este arquivo) -> caminho a partir da raiz do repo.
const doRepo = (p: string) =>
  decodeURIComponent(new URL(p, 'file:///repo/apps/ohara/front/src/').pathname).replace('/repo/', '');

// Todo seed.*.json no disco, na pasta canônica. Só os caminhos (glob
// preguiçoso): serve para provar que nenhum seed fica de fora de SEEDS.
const SEEDS_NO_DISCO = Object.keys(import.meta.glob('../../../../packages/ohara-data/seed.*.json')).map(doRepo);

// Todo .json do repo, com o conteúdo cru. O glob do Vite já pula pastas ocultas
// (.git, .turbo, .pages); node_modules e saídas de build saem pelos padrões "!".
const JSONS_DO_REPO = Object.entries(
  import.meta.glob<string>(
    ['../../../../**/*.json', '!**/node_modules/**', '!**/dist/**', '!**/target/**'],
    { query: '?raw', import: 'default', eager: true },
  ),
).map(([p, conteudo]) => [doRepo(p), conteudo] as const);

// Guarda contra uma segunda cópia do seed ou do schema. Um arquivo é "dado do
// Ohara" se tem nome de seed num caminho do Ohara, se tem a forma de um seed de
// trilha (trail.id + nodes[]) ou se declara o $id do schema. Pela forma pega
// também uma cópia renomeada e já divergente do original.
const SCHEMA_ID = (schema as { $id: string }).$id;

function ehDadoDoOhara(relPath: string, conteudo: string): boolean {
  const nome = relPath.slice(relPath.lastIndexOf('/') + 1);
  if (/^seed.*\.json$/i.test(nome) && /ohara/i.test(relPath)) return true;
  let json: unknown;
  try {
    json = JSON.parse(conteudo);
  } catch {
    return false;
  }
  if (json === null || typeof json !== 'object') return false;
  const obj = json as { trail?: { id?: unknown }; nodes?: unknown; $id?: unknown };
  const formaDeSeed = typeof obj.trail?.id === 'string' && Array.isArray(obj.nodes);
  return formaDeSeed || obj.$id === SCHEMA_ID;
}

const DADOS_DO_OHARA = JSONS_DO_REPO.filter(([rel, conteudo]) => ehDadoDoOhara(rel, conteudo)).map(
  ([rel]) => rel,
);

type Seed = { nodes: { explainers?: unknown[] }[] };

// Garante que o seed foi rejeitado pelo campo sob teste, e não por outro motivo.
const errosFora = (prefixo: string) =>
  (validate.errors ?? []).filter((e) => !e.instancePath.startsWith(prefixo));
const errosForaDoExplicador = () => errosFora('/nodes/0/explainers');

describe('schema do seed (ajv): guardas contra teste que passa vazio', () => {
  it('SEEDS lista exatamente os seeds que existem no disco', () => {
    // Se um seed deixar de ser importado (ou um novo for criado sem entrar em SEEDS),
    // o it.each acima roda menos casos e continua verde. Este teste pega isso.
    expect(SEEDS_NO_DISCO.length).toBeGreaterThanOrEqual(1);
    expect(SEEDS.map(([path]) => path).sort()).toEqual([...SEEDS_NO_DISCO].sort());
  });

  it('seed e schema do Ohara só existem em packages/ohara-data (uma cópia só)', () => {
    // Uma cópia fora daqui volta a ser lida por alguém e diverge em silêncio.
    // Importe de @jpfig/ohara-data em vez de copiar o arquivo.
    const fora = DADOS_DO_OHARA.filter((rel) => !rel.startsWith(`${PASTA_CANONICA}/`));
    expect(fora).toEqual([]);
    expect([...DADOS_DO_OHARA].sort()).toEqual(
      [...SEEDS_NO_DISCO, `${PASTA_CANONICA}/schema.json`].sort(),
    );
  });

  it('a varredura da guarda vê o repo (não passa vazia)', () => {
    const jsons = JSONS_DO_REPO.map(([rel]) => rel);
    expect(jsons).toContain('package.json');
    expect(jsons).toContain('apps/ohara/front/package.json');
    expect(jsons).toContain(`${PASTA_CANONICA}/schema.json`);
    expect(jsons.some((rel) => rel.includes('node_modules/'))).toBe(false);
  });

  const seedJson = JSON.stringify(seedDistributedSystems);
  it.each([
    ['cópia do seed no front', 'apps/ohara/front/src/data/seed.distributed-systems.json', seedJson],
    ['seed renomeado e alterado fora de pasta do Ohara', 'web/src/data/trilha.json',
      JSON.stringify({ ...seedDistributedSystems, nodes: [] })],
    ['cópia do schema com outro nome', 'web/src/data/contrato.json', JSON.stringify(schema)],
    ['seed* quebrado num caminho do Ohara', 'apps/ohara/front/src/data/seed.novo.json', '{'],
  ])('a guarda reconhece como dado do Ohara: %s', (_caso, rel, conteudo) => {
    expect(ehDadoDoOhara(rel, conteudo)).toBe(true);
  });

  it('a guarda ignora seed.json de outro projeto (sem trail)', () => {
    const outro = JSON.stringify({ nodes: [], edges: [] });
    expect(ehDadoDoOhara('web/src/data/outro/seed.json', outro)).toBe(false);
  });

  it.each(SEEDS)('%s não está truncado (≥ 26 nós)', (_path, seed) => {
    // 26 é o tamanho atual da trilha; se a trilha crescer, continua valendo.
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

// URLs viram href no NodeModal: só https com host. Outros esquemas (javascript:,
// vbscript:, http:, ftp:) e formas sem autoridade ("https:host", "https://")
// passariam pelo `format: uri` sozinho.
const URLS_REJEITADAS: [string, string][] = [
  ['javascript:', 'javascript:alert(1)'],
  ['vbscript:', 'vbscript:msgbox(1)'],
  ['http:', 'http://example.org/'],
  ['https:// sem host', 'https://'],
  ['https: sem //', 'https:evil.example'],
  ['ftp:', 'ftp://example.org/arquivo'],
];

describe('schema do seed (ajv): url só https', () => {
  it.each(URLS_REJEITADAS)('rejeita url de explicador: %s', (_caso, url) => {
    expect(validate(withExplainer({ ...freeExplainer, url }))).toBe(false);
    expect(errosForaDoExplicador()).toEqual([]);
  });

  it.each(URLS_REJEITADAS)('rejeita url de fonte: %s', (_caso, url) => {
    const seed = validSeed() as { nodes: { sources: Record<string, unknown>[] }[] };
    seed.nodes[0].sources = [{ sourceType: 'free', url }];
    expect(validate(seed)).toBe(false);
    expect(errosFora('/nodes/0/sources')).toEqual([]);
  });

  it('aceita url https de fonte', () => {
    const seed = validSeed() as { nodes: { sources: Record<string, unknown>[] }[] };
    seed.nodes[0].sources = [{ sourceType: 'free', url: 'https://example.org/paper.pdf' }];
    const ok = validate(seed);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe('schema do seed (ajv): textos vazios', () => {
  // label vazio vira cartão sem título; query vazia vira busca vazia na loja.
  it.each([
    ['label vazio', { ...freeExplainer, label: '' }],
    ['retail com query vazia e sem url', { label: 'X', kind: 'book', sourceType: 'retail', query: '' }],
  ])('rejeita explicador: %s', (_caso, explainer) => {
    expect(validate(withExplainer(explainer))).toBe(false);
    expect(errosForaDoExplicador()).toEqual([]);
  });

  it('rejeita nó com label vazio', () => {
    const seed = validSeed();
    seed.nodes[0].label = '';
    expect(validate(seed)).toBe(false);
    expect(validate.errors?.map((e) => e.instancePath)).toEqual(['/nodes/0/label']);
  });
});

// Caracterização: o schema não exige url nem query em explicador retail/preview-embed,
// e o NodeModal mostra esse cartão sem botão. Se a regra mudar, estes testes devem
// ser trocados por casos de rejeição.
describe('schema do seed (ajv): comportamento atual', () => {
  it.each([
    ['retail', { label: 'X', kind: 'book', sourceType: 'retail' }],
    ['preview-embed', { label: 'X', kind: 'book', sourceType: 'preview-embed' }],
  ])('HOJE aceita explicador %s sem url e sem query', (_caso, explainer) => {
    const ok = validate(withExplainer(explainer));
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });
});
