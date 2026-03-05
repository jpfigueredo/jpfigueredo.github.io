import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: [/^https:\/\/(.*\.)?github\.io$/, /localhost:\d+$/] }));
app.use(express.json());

// Health
app.get('/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0-beta.1' }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/echo', (req, res) => res.json({ query: req.query }));

// SW Timeline events
const swTimelineEvents = [
  {
    id: 'turing-1936', year: 1936, title: 'Máquina de Turing',
    shortDescription: 'Alan Turing define formalmente o conceito de computação algorítmica.',
    theoryTags: ['theory', 'labor'],
    marxistAnalysis: 'A abstração máquina de Turing surge no contexto da crise do capitalismo dos anos 1930. Turing formaliza o trabalho mental abstrato — separando o algoritmo (trabalho vivo) da máquina (trabalho morto cristalizado). O Estado britânico financiou essa pesquisa como resposta à necessidade militar de automatizar o trabalho de decodificação.',
    sources: [{ label: 'Turing, 1936', url: 'https://www.cs.virginia.edu/~robins/Turing_Paper_1936.pdf' }],
  },
  {
    id: 'eniac-1945', year: 1945, title: 'ENIAC',
    shortDescription: 'Primeiro computador eletrônico de propósito geral entra em operação.',
    theoryTags: ['industry', 'labor'],
    marxistAnalysis: 'O ENIAC foi financiado pelo Exército dos EUA para calcular tabelas balísticas — automação de trabalho intelectual a serviço do capital de guerra. O projeto empregou mulheres como "computadoras humanas" antes da máquina, tornando visível que o trabalho de computação era trabalho desvalorizado e feminizado.',
    sources: [{ label: 'Ensmenger, 2010', url: 'https://mitpress.mit.edu/9780262050555/' }],
  },
  {
    id: 'software-crisis-1968', year: 1968, title: 'Crise do Software',
    shortDescription: 'Conferência da OTAN cunha o termo "engenharia de software" como resposta à crise.',
    theoryTags: ['theory', 'labor'],
    marxistAnalysis: 'A "crise do software" é, em termos marxistas, uma crise de produtividade do trabalho intelectual. O capital percebeu que o desenvolvimento de software era imprevisível e caro. A resposta foi a engenharia de software: taylorização do trabalho cognitivo, tentativa de transformar artesanato em linha de montagem.',
    sources: [{ label: 'Naur & Randell, 1969', url: 'http://homepages.cs.ncl.ac.uk/brian.randell/NATO/nato1968.PDF' }],
  },
  {
    id: 'unix-1969', year: 1969, title: 'Unix',
    shortDescription: 'Ken Thompson e Dennis Ritchie criam o Unix nos Bell Labs.',
    theoryTags: ['industry', 'oss'],
    marxistAnalysis: 'Unix surge como projeto de pesquisa dentro de uma megacorporação (AT&T/Bell Labs). A filosofia "tudo é arquivo" e a modularidade criaram os fundamentos técnicos que depois seriam apropriados pelo movimento open-source. O fato de ter sido criado em laboratório corporativo revela a contradição: a inovação técnica radical nasce dentro das estruturas do capital.',
    sources: [{ label: 'Ritchie & Thompson, 1974', url: 'https://dl.acm.org/doi/10.1145/361011.361061' }],
  },
  {
    id: 'gnu-1983', year: 1983, title: 'GNU Project',
    shortDescription: 'Richard Stallman lança o GNU Project e a Free Software Foundation.',
    theoryTags: ['oss', 'theory'],
    marxistAnalysis: 'Stallman articula uma crítica radical à propriedade intelectual no software. O copyleft é uma inversão dialética: usa as ferramentas jurídicas do capitalismo (copyright) para garantir o commons digital. A GPL força a socialização do código — quem usa deve devolver. É uma forma de resistência aos cercamentos digitais.',
    sources: [{ label: 'GNU Manifesto', url: 'https://www.gnu.org/gnu/manifesto.html' }],
  },
  {
    id: 'linux-1991', year: 1991, title: 'Linux',
    shortDescription: 'Linus Torvalds inicia o kernel Linux como projeto pessoal.',
    theoryTags: ['oss', 'industry'],
    marxistAnalysis: 'O Linux demonstrou que a produção colaborativa descentralizada de software complexo é possível sem gestão capitalista direta. O modelo de bazaar (Raymond) versus catedral é uma contradição viva dentro do capital: a IBM, a Red Hat e depois a Microsoft precisam do Linux para sobreviver, mas o Linux nega a lógica do software proprietário.',
    sources: [{ label: 'Torvalds, 1991 (Usenet)', url: 'https://groups.google.com/g/comp.os.minix/c/dlNtH7RRrGA' }],
  },
  {
    id: 'macintosh-1984', year: 1984, title: 'Apple Macintosh',
    shortDescription: 'Apple lança o Macintosh, democratizando a interface gráfica.',
    theoryTags: ['industry'],
    marxistAnalysis: 'O Macintosh marca a mercantilização da GUI — tecnologia originalmente desenvolvida no PARC da Xerox (pesquisa pública corporativa). Apple transformou uma inovação coletiva em commodity de alto valor, criando o template do "design premium" como diferencial de mercado. É a subsunção real da experiência estética pelo capital: a usabilidade se torna fetiche da mercadoria.',
    sources: [{ label: 'Levy, 1994 — Insanely Great', url: 'https://www.penguinrandomhouse.com/books/86797/insanely-great-by-steven-levy/' }],
  },
  {
    id: 'java-1995', year: 1995, title: 'Java e "Write Once, Run Anywhere"',
    shortDescription: 'Sun Microsystems lança Java com a promessa de portabilidade universal.',
    theoryTags: ['theory', 'industry'],
    marxistAnalysis: '"Write Once, Run Anywhere" é uma promessa de universalidade que mascara uma estratégia de padronização corporativa. A JVM é um meio de produção controlado pela Sun (depois Oracle). A certificação Java criou um mercado de trabalho segmentado onde o conhecimento técnico específico é transformado em capital humano vendável. A guerra de patentes Java-Google (2010s) expôs a contradição entre o discurso de abertura e a realidade da propriedade intelectual.',
    sources: [{ label: 'Gosling et al., Java Spec', url: 'https://docs.oracle.com/javase/specs/' }],
  },
  {
    id: 'agile-2001', year: 2001, title: 'Manifesto Ágil',
    shortDescription: 'Dezessete desenvolvedores publicam o Manifesto para Desenvolvimento Ágil de Software.',
    theoryTags: ['theory', 'labor'],
    marxistAnalysis: 'O Manifesto Ágil é a resposta do trabalho qualificado à taylorização da engenharia de software. Em vez de processos rígidos, valoriza pessoas e interações — uma tentativa de recuperar a autonomia artesanal. Porém, na prática corporativa, o Agile foi reapropriado como ferramenta de intensificação do trabalho: sprints acelerados, standups diários e velocity metrics transformaram autonomia em autoexploração.',
    sources: [{ label: 'Agile Manifesto', url: 'https://agilemanifesto.org/' }],
  },
  {
    id: 'saas-2005', year: 2005, title: 'Ascensão do SaaS',
    shortDescription: 'Salesforce populariza o modelo Software-as-a-Service, transformando software em serviço.',
    theoryTags: ['saas', 'industry'],
    marxistAnalysis: 'O SaaS completa a transição do software de bem (produto) para serviço (renda). É a aplicação digital da lógica do aluguel: o usuário nunca possui o software, apenas acessa. Isso cria dependência estrutural (lock-in de dados) e transforma a relação de compra em relação de assinatura permanente — extração contínua de mais-valor via modelo de assinatura.',
    sources: [{ label: 'Cusumano, 2010 — The Business of Software', url: 'https://mitpress.mit.edu/9780262514620/' }],
  },
  {
    id: 'iphone-2007', year: 2007, title: 'iPhone e a Plataformização',
    shortDescription: 'Apple lança o iPhone, inaugurando a era dos ecossistemas mobile fechados.',
    theoryTags: ['industry', 'saas'],
    marxistAnalysis: 'O iPhone não vendeu apenas um dispositivo — vendeu um ecossistema fechado onde a Apple extrai rent de cada transação (30% na App Store). É o modelo de plataforma: o capital se posiciona como mediador obrigatório entre produtores (devs) e consumidores (usuários), capturando valor sem produzir diretamente. O walled garden transforma a criatividade dos desenvolvedores em trabalho para a plataforma.',
    sources: [{ label: 'Parker et al., 2016 — Platform Revolution', url: 'https://wwnorton.com/books/Platform-Revolution/' }],
  },
  {
    id: 'github-2008', year: 2008, title: 'GitHub',
    shortDescription: 'GitHub lança e se torna a plataforma central de colaboração em software.',
    theoryTags: ['oss', 'saas'],
    marxistAnalysis: 'O GitHub transformou a contribuição open-source em trabalho não-remunerado visível e rastreável pelo capital. O "perfil do GitHub" como portfólio de contratação tornou o trabalho de lazer (contribuições OSS) em capital simbólico exigido para emprego. A aquisição pela Microsoft em 2018 por $7.5B mostrou o valor acumulado de bilhões de horas de trabalho voluntário.',
    sources: [{ label: 'Kelty, 2008 — Two Bits', url: 'https://twobits.net/' }],
  },
  {
    id: 'kubernetes-2014', year: 2014, title: 'Kubernetes',
    shortDescription: 'Google open-sourcea o Kubernetes, transformando a infraestrutura de software.',
    theoryTags: ['industry', 'oss'],
    marxistAnalysis: 'O Google liberou o Kubernetes não por altruísmo, mas porque a padronização da orquestração de containers beneficiava seu negócio de cloud (GKE). É a estratégia "comoditize your complement": tornar gratuito o que está abaixo na stack para vender mais caro o que está acima. A CNCF (fundação neutra) é a institucionalização da governança técnica compartilhada entre concorrentes capitalistas.',
    sources: [{ label: 'Burns et al., 2016', url: 'https://dl.acm.org/doi/10.1145/2898442' }],
  },
  {
    id: 'chatgpt-2022', year: 2022, title: 'ChatGPT',
    shortDescription: 'OpenAI lança o ChatGPT, popularizando os Large Language Models.',
    theoryTags: ['theory', 'labor'],
    marxistAnalysis: 'Os LLMs são destilações do trabalho humano acumulado: treinados em texto escrito por milhões de trabalhadores sem compensação. O "alinhamento" via RLHF usa trabalhadores no Quênia a $2/hora para rotular conteúdo violento. A contradição: uma tecnologia que pode automatizar trabalho cognitivo foi construída sobre a hiperexploração de trabalho cognitivo periférico.',
    sources: [{ label: 'TIME, 2023 — OpenAI Kenya workers', url: 'https://time.com/6247678/openai-chatgpt-kenya-workers/' }],
  },
];

app.get('/api/sw-timeline/events', (_req, res) => {
  res.json({ events: swTimelineEvents, total: swTimelineEvents.length });
});

// Kafka Viz simulated state
app.get('/api/kafka-viz/state', (_req, res) => {
  const scenario = /** @type {string} */ (_req.query['scenario']) || 'single-broker';

  const singleBroker = {
    scenario: 'single-broker',
    brokers: [
      {
        id: 'broker-0', host: 'kafka-0:9092', isLeader: true,
        partitions: [
          { id: 0, topic: 'user-events', leader: 'broker-0', replicas: ['broker-0'], logSize: 42 },
          { id: 1, topic: 'user-events', leader: 'broker-0', replicas: ['broker-0'], logSize: 37 },
          { id: 2, topic: 'user-events', leader: 'broker-0', replicas: ['broker-0'], logSize: 55 },
        ],
      },
    ],
    producers: [{ id: 'prod-0', topic: 'user-events', partitionStrategy: 'round-robin' }],
    consumers: [{ id: 'cons-0', groupId: 'my-group', topic: 'user-events', assignedPartitions: [0, 1, 2], lag: 3 }],
  };

  const multiBroker = {
    scenario: 'multi-broker',
    brokers: [
      {
        id: 'broker-0', host: 'kafka-0:9092', isLeader: true,
        partitions: [
          { id: 0, topic: 'orders', leader: 'broker-0', replicas: ['broker-0', 'broker-1'], logSize: 120 },
          { id: 1, topic: 'orders', leader: 'broker-0', replicas: ['broker-0', 'broker-2'], logSize: 98 },
        ],
      },
      {
        id: 'broker-1', host: 'kafka-1:9092', isLeader: false,
        partitions: [
          { id: 2, topic: 'orders', leader: 'broker-1', replicas: ['broker-1', 'broker-0'], logSize: 110 },
        ],
      },
      {
        id: 'broker-2', host: 'kafka-2:9092', isLeader: false,
        partitions: [],
      },
    ],
    producers: [
      { id: 'prod-0', topic: 'orders', partitionStrategy: 'key-hash' },
      { id: 'prod-1', topic: 'orders', partitionStrategy: 'key-hash' },
    ],
    consumers: [
      { id: 'cons-0', groupId: 'order-processors', topic: 'orders', assignedPartitions: [0], lag: 0 },
      { id: 'cons-1', groupId: 'order-processors', topic: 'orders', assignedPartitions: [1], lag: 5 },
      { id: 'cons-2', groupId: 'order-processors', topic: 'orders', assignedPartitions: [2], lag: 2 },
    ],
  };

  const state = scenario === 'multi-broker' ? multiBroker : singleBroker;
  res.json(state);
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`bff-api listening on :${port}`));
