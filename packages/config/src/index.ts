export const version = '1.0.0-beta.1';

export const apps = {
  swTimeline: {
    basePath: '/apps/sw-timeline/',
    iframeSrcProd: 'https://jpfigueredo.github.io/apps/sw-timeline/index.html',
  },
  ohara: {
    basePath: '/apps/ohara/front/',
    iframeSrcProd: 'https://jpfigueredo.github.io/apps/ohara/front/index.html',
  },
  kafkaViz: {
    basePath: '/apps/kafka-viz/',
    iframeSrcProd: 'https://jpfigueredo.github.io/apps/kafka-viz/index.html',
  },
  angularDemo: {
    basePath: '/apps/angular-demo/',
    iframeSrcProd: 'https://jpfigueredo.github.io/apps/angular-demo/index.html',
  },
} as const;

export const api = {
  // Updated after deploy — use VITE_BFF_URL env var in dev to override
  bffBaseUrl: 'https://jpfig-bff-api.onrender.com',
  rustApiBaseUrl: 'https://jpfig-rust-api.onrender.com',
  edgeProxyUrl: 'https://edge-proxy.workers.dev',
} as const;

export const features = {
  swTimelineAnalysis: true,
  kafkaViz: true,
  angularDemo: true,
} as const;
