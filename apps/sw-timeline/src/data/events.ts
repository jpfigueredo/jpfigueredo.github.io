export type TimelineEvent = {
  id: string;
  year: number;
  date?: string;
  title: string;
  shortDescription: string;
  theoryTags: string[];
  marxistAnalysis: string;
  sources: { label: string; url: string }[];
};

export const sampleEvents: TimelineEvent[] = [
  {
    id: 'turing-1936',
    year: 1936,
    title: 'Turing – On Computable Numbers',
    shortDescription:
      'Artigo fundador da teoria da computação, introduzindo a máquina de Turing como modelo abstrato de processamento.',
    theoryTags: ['computation', 'theory'],
    marxistAnalysis:
      'Surge em contexto de industrialização avançada e mecanização do trabalho intelectual. A "máquina universal" antecipa a possibilidade de automatizar tarefas antes reservadas a trabalhadores altamente qualificados — uma das primeiras formalizações da substituição do trabalho vivo pelo trabalho morto no plano do intelecto.',
    sources: [
      {
        label: 'Proceedings of the London Mathematical Society (1936)',
        url: 'https://doi.org/10.1112/plms/s2-42.1.230'
      }
    ]
  },
  {
    id: 'eniac-1945',
    year: 1945,
    title: 'ENIAC – Computador eletrônico de propósito geral',
    shortDescription:
      'Primeiro computador eletrônico de grande escala, desenvolvido pela Universidade da Pensilvânia para o Exército dos EUA durante a 2ª Guerra Mundial.',
    theoryTags: ['computation', 'industry'],
    marxistAnalysis:
      'A computação nasce sob financiamento militar estatal — o Estado capitalista, pressionado pela lógica de guerra (concorrência extrema entre blocos), financia a inovação tecnológica que a iniciativa privada não teria assumido sozinha. Isso estabelece o padrão histórico: o setor público absorve os riscos e os custos de P&D enquanto os lucros migram posteriormente ao capital privado.',
    sources: [
      {
        label: 'ENIAC – Wikipedia',
        url: 'https://en.wikipedia.org/wiki/ENIAC'
      }
    ]
  },
  {
    id: 'software-crisis-1968',
    year: 1968,
    title: '"Software Crisis" – Conferência NATO',
    shortDescription:
      'A NATO reúne cientistas em Garmisch (Alemanha) para discutir o caos no desenvolvimento de software: atrasos, estouros de orçamento, baixa qualidade.',
    theoryTags: ['theory', 'industry'],
    marxistAnalysis:
      'A "crise do software" é, em essência, uma crise de gestão do trabalho intelectual sob a lógica do capital. Com a escala dos sistemas crescendo exponencialmente, os métodos artesanais de programação tornam-se incompatíveis com a necessidade de previsibilidade e lucro. Surge a Engenharia de Software como tentativa de industrializar o trabalho cognitivo — aplicar ao código o mesmo taylorismo que transformou a produção manufatureira.',
    sources: [
      {
        label: 'Software Crisis – NATO Science Committee (1968)',
        url: 'https://en.wikipedia.org/wiki/Software_crisis'
      }
    ]
  },
  {
    id: 'unix-1969',
    year: 1969,
    title: 'Unix – AT&T Bell Labs',
    shortDescription:
      'Ken Thompson e Dennis Ritchie desenvolvem o Unix nos Bell Labs, estabelecendo princípios de design que moldam todos os sistemas operacionais modernos.',
    theoryTags: ['theory', 'open-source'],
    marxistAnalysis:
      'O Unix emerge como subproduto de um projeto de pesquisa corporativa (AT&T/Bell Labs), financiado indiretamente por monopólio regulado. Sua distribuição gratuita para universidades nos anos 1970 — antes de ser privatizado na década de 1980 — demonstra a tensão entre o conhecimento como bem comum e sua eventual captura pelo capital. A história do Unix é um arquétipo da cercamento digital (enclosure).',
    sources: [
      {
        label: 'The Unix Heritage Society',
        url: 'https://www.tuhs.org/'
      }
    ]
  },
  {
    id: 'macintosh-1984',
    year: 1984,
    title: 'Apple Macintosh – Mercantilização da GUI',
    shortDescription:
      'Apple lança o Macintosh com interface gráfica, transformando a computação pessoal num produto de massa e inaugurando a era do "design premium".',
    theoryTags: ['industry', 'commons'],
    marxistAnalysis:
      'A GUI foi inventada no PARC da Xerox — pesquisa financiada por capital corporativo que nunca soube monetizá-la. A Apple capturou essa inovação coletiva e a transformou em commodity de alto valor, adicionando trabalho de design como fetiche da mercadoria: o consumidor paga pela experiência estética como diferenciador de classe. O Macintosh estabelece o template do "design premium" como estratégia de extração de mais-valia: preço acima do valor de uso, justificado pelo valor de signo (Baudrillard). A ideia de que a tecnologia pode ser "bela" torna-se instrumento de extração de rendas monopolistas.',
    sources: [
      {
        label: 'Levy, S. – Insanely Great (1994)',
        url: 'https://www.penguinrandomhouse.com/books/86797/insanely-great-by-steven-levy/'
      }
    ]
  },
  {
    id: 'gnu-1983',
    year: 1983,
    title: 'Projeto GNU – Richard Stallman',
    shortDescription:
      'Richard Stallman anuncia o projeto GNU, buscando criar um sistema operacional completamente livre como resposta à crescente privatização do software.',
    theoryTags: ['open-source', 'commons'],
    marxistAnalysis:
      'Resposta direta à mercantilização do software. O movimento de software livre pode ser lido como tentativa de reconstruir os commons digitais em meio à privatização dos meios de produção informacionais. Stallman formula "liberdades" (usar, estudar, modificar, distribuir) como direitos contra a propriedade privada do código — uma posição que, embora não explicitamente marxista, tensiona diretamente com a lógica da acumulação por cercamento.',
    sources: [
      {
        label: 'GNU Manifesto',
        url: 'https://www.gnu.org/gnu/manifesto.pt-br.html'
      }
    ]
  },
  {
    id: 'linux-1991',
    year: 1991,
    title: 'Linux – Linus Torvalds',
    shortDescription:
      'Linus Torvalds anuncia o Linux como projeto pessoal e convida colaborações. Combinado com as ferramentas GNU, forma o sistema GNU/Linux.',
    theoryTags: ['open-source', 'commons'],
    marxistAnalysis:
      'O Linux demonstra que a produção colaborativa distribuída — sem controle centralizado de um capitalista individual — pode gerar infraestrutura tecnológica de qualidade superior à produção proprietária. É um exemplo empírico de produção de pares baseada em commons (commons-based peer production, Benkler). Paradoxalmente, o Linux tornou-se a espinha dorsal de data centers corporativos globais: o capital usa os commons como infraestrutura gratuita para sua própria acumulação.',
    sources: [
      {
        label: 'The Linux Kernel Archives',
        url: 'https://www.kernel.org/'
      },
      {
        label: 'Anúncio original – comp.os.minix (1991)',
        url: 'https://groups.google.com/g/comp.os.minix/c/dlNtH7RRrGA'
      }
    ]
  },
  {
    id: 'java-1995',
    year: 1995,
    title: 'Java – "Write Once, Run Anywhere"',
    shortDescription:
      'Sun Microsystems lança Java com a promessa de portabilidade universal via JVM, inaugurando a era da padronização corporativa do desenvolvimento.',
    theoryTags: ['theory', 'industry'],
    marxistAnalysis:
      '"Write Once, Run Anywhere" é uma promessa de universalidade que mascara uma estratégia de lock-in corporativo: a JVM como meio de produção controlado pela Sun (depois Oracle). A certificação Java criou um mercado de trabalho segmentado onde o conhecimento técnico específico se transforma em capital humano vendável — o saber-fazer do programador é capturado e padronizado para facilitar a substituição entre trabalhadores. A guerra de patentes Java vs. Google (2010s) expôs a contradição central: o discurso de abertura e universalidade da plataforma serve à acumulação privada de propriedade intelectual.',
    sources: [
      {
        label: 'Java Language Specification – Oracle',
        url: 'https://docs.oracle.com/javase/specs/'
      }
    ]
  },
  {
    id: 'agile-manifesto-2001',
    year: 2001,
    title: 'Manifesto Ágil',
    shortDescription:
      '17 desenvolvedores reunidos em Snowbird (Utah) publicam o Manifesto for Agile Software Development, rejeitando processos pesados em favor de iteração e colaboração.',
    theoryTags: ['theory', 'industry'],
    marxistAnalysis:
      'O Manifesto Ágil é uma resposta à alienação do desenvolvedor sob metodologias pesadas tipo Waterfall, onde o programador executava ordens sem entender o produto. Porém, ao ser capturado pelo mercado corporativo (SAFe, LeSS, "Agile empresarial"), o agilismo torna-se ferramenta de intensificação do trabalho: sprints como mecanismo de extração máxima de valor dentro de ciclos curtos, standups diários como vigilância gerencial, "cultura de feedback" mascarando precarização. Um movimento de emancipação convertido em instrumento de controle.',
    sources: [
      {
        label: 'Manifesto for Agile Software Development',
        url: 'https://agilemanifesto.org/'
      }
    ]
  },
  {
    id: 'saas-2000s',
    year: 2005,
    title: 'Consolidação do SaaS',
    shortDescription:
      'Software como serviço se consolida como modelo dominante para aplicações empresariais e de consumo, com Salesforce como precursor desde 1999.',
    theoryTags: ['industry', 'saas'],
    marxistAnalysis:
      'Transforma o software de bem (vendido uma vez) em assinatura contínua — renda recorrente garantida. Reforça o controle sobre os usuários (lock-in, dados retidos) e cria fluxos de renda-monopólio. Também facilita a vigilância massiva: os dados do usuário tornam-se matéria-prima para extração de valor (economia da atenção, discriminação de preços, venda a anunciantes). O SaaS é a passagem do software como produto para o software como extrator de renda contínuo.',
    sources: [
      {
        label: '"Software as a Service: Strategic Background" – IEEE',
        url: 'https://ieeexplore.ieee.org/'
      }
    ]
  },
  {
    id: 'iphone-2007',
    year: 2007,
    title: 'iPhone – Plataformização e Walled Garden',
    shortDescription:
      'Apple lança o iPhone, inaugurando a era dos ecossistemas mobile fechados e o modelo de plataforma como extrator obrigatório de renda entre produtores e consumidores.',
    theoryTags: ['industry', 'saas'],
    marxistAnalysis:
      'O iPhone não vendeu apenas um dispositivo — vendeu um ecossistema fechado onde a Apple se posiciona como mediador obrigatório entre desenvolvedores (produtores) e usuários (consumidores), capturando 30% de cada transação via App Store. É o modelo de plataforma em sua forma mais pura: o capital como pura mediação, extraindo renda sem produzir diretamente. O walled garden transforma a criatividade dos desenvolvedores em trabalho para a plataforma. A "revolução" do iPhone é, na realidade, uma revolução na forma de extração de renda: do modelo de produto para o modelo de pedágio sobre a circulação de mercadorias digitais.',
    sources: [
      {
        label: 'Parker et al. – Platform Revolution (2016)',
        url: 'https://wwnorton.com/books/Platform-Revolution/'
      }
    ]
  },
  {
    id: 'github-2008',
    year: 2008,
    title: 'GitHub – "Social Coding"',
    shortDescription:
      'Tom Preston-Werner, Chris Wanstrath e PJ Hyett lançam o GitHub, transformando o Git em plataforma social e tornando a colaboração open-source massiva.',
    theoryTags: ['open-source', 'commons', 'industry'],
    marxistAnalysis:
      'O GitHub privatiza a infraestrutura dos commons digitais: o trabalho voluntário de milhões de desenvolvedores gera valor que é capturado por uma plataforma (vendida à Microsoft por US$7,5bi em 2018). É o modelo clássico de extração de renda de plataforma (platform rent): o trabalho coletivo dos contribuidores — gratuito — torna a plataforma valiosa, enquanto os lucros ficam com o proprietário da infraestrutura. Um cercamento do trabalho commons.',
    sources: [
      {
        label: 'GitHub – Wikipedia',
        url: 'https://en.wikipedia.org/wiki/GitHub'
      }
    ]
  },
  {
    id: 'kubernetes-2014',
    year: 2014,
    title: 'Kubernetes – Google / CNCF',
    shortDescription:
      'Google open-sourcea o Kubernetes (derivado do Borg interno), estabelecendo o padrão de orquestração de contêineres e impulsionando a adoção em nuvem.',
    theoryTags: ['industry', 'open-source'],
    marxistAnalysis:
      'Kubernetes é um presente estratégico do capital monopolista (Google) para toda a indústria: ao open-sourcear sua ferramenta interna, o Google destrói a possibilidade de um concorrente menor construir vantagem competitiva em orquestração e, ao mesmo tempo, expande o ecossistema de nuvem (GCP, EKS, AKS) do qual o próprio Google se beneficia. Representa também a precarização da infraestrutura: operações que antes exigiam equipes de SysAdmins são abstraídas — redução de postos de trabalho disfarçada de "eficiência".',
    sources: [
      {
        label: 'Kubernetes – kubernetes.io',
        url: 'https://kubernetes.io/'
      }
    ]
  },
  {
    id: 'chatgpt-2022',
    year: 2022,
    title: 'ChatGPT / IA Generativa',
    shortDescription:
      'A OpenAI lança o ChatGPT, popularizando os LLMs e inaugurando uma nova fase da automação: a substituição do trabalho intelectual criativo por IA.',
    theoryTags: ['ai', 'industry'],
    marxistAnalysis:
      'Os LLMs são treinados em trabalho não-remunerado da humanidade (textos, código, arte) sem consentimento nem compensação — a maior expropriação de trabalho vivo da história. Ao automatizar escrita, código e design, ampliam a composição orgânica do capital (mais máquina, menos trabalho vivo), pressionando para baixo o valor da força de trabalho cognitiva. A IA generativa não substitui o capitalismo — aprofunda sua lógica: acelera a extração de mais-valia ao substituir trabalhadores intelectuais com ferramentas cujo custo de reprodução tende a zero.',
    sources: [
      {
        label: 'Attention Is All You Need – Vaswani et al. (2017)',
        url: 'https://arxiv.org/abs/1706.03762'
      }
    ]
  }
];
