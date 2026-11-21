export interface TrailCard {
  id: string;
  title: string;
  subtitle?: string;
}

// Catálogo de trilhas disponíveis. Com uma só, o app abre direto nela;
// a home de escolha aparece a partir de duas.
export const TRAILS: TrailCard[] = [
  {
    id: 'distributed-systems-architecture',
    title: 'Arquitetura de Software',
    subtitle: 'De Turing a Newman · 26 obras',
  },
];
