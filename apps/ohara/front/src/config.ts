// External Configuration pattern: de onde vêm os dados da trilha.
// Trocar estático → API é mudança de CONFIG, não de código.
export type DataSource =
  | { kind: 'static'; trailId: string }
  | { kind: 'api'; baseUrl: string; trailId: string };

export interface AppConfig {
  dataSource: DataSource;
  // afiliado/ads/flags entram aqui depois (nunca hardcoded no componente).
  amazonTag?: string;
}

export const config: AppConfig = {
  dataSource: { kind: 'static', trailId: 'distributed-systems-architecture' },
};
