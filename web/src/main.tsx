import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { PageContainer, NeonText } from '@jpfig/ui';
import './index.css';

const IframeViewport: React.FC<{ src: string; title: string }> = ({ src, title }) => (
  <iframe title={title} src={src} style={{ width: '100%', height: '80vh', border: '1px solid #223', borderRadius: 8 }} />
);

const SidebarMenu: React.FC = () => (
  <aside className="p-4 border-r border-slate-700 min-w-[220px]">
    <nav className="flex flex-col gap-2">
      <a className="text-neon hover:underline" href="/">Início</a>
      <a className="hover:underline" href="/projects/doom64">DOOM64 (WASM)</a>
      <a className="hover:underline" href="/projects/sw-timeline">SW Timeline</a>
      <a className="hover:underline" href="/docs">Docs</a>
    </nav>
  </aside>
);

const Home = () => (
  <PageContainer>
    <div className="flex">
      <SidebarMenu />
      <div className="p-6">
        <h1 className="text-2xl"><NeonText>Portfolio</NeonText> – jpfigueredo</h1>
        <p className="mt-2">Escolha um projeto no menu.</p>
      </div>
    </div>
  </PageContainer>
);

const Doom64 = () => (
  <PageContainer>
    <div className="flex">
      <SidebarMenu />
      <div className="p-6 w-full">
        <h2><NeonText>DOOM64 (WASM)</NeonText></h2>
        <IframeViewport src="/apps/doom64-wasm/index.html" title="doom64" />
      </div>
    </div>
  </PageContainer>
);

const SwTimeline = () => (
  <PageContainer>
    <div className="flex">
      <SidebarMenu />
      <div className="p-6 w-full">
        <h2><NeonText>SW Timeline</NeonText></h2>
        <IframeViewport src="/apps/sw-timeline/index.html" title="sw-timeline" />
      </div>
    </div>
  </PageContainer>
);

import IntroDoc from './docs/intro.mdx';
const Docs = () => (
  <PageContainer>
    <div className="flex">
      <SidebarMenu />
      <div className="p-6 prose prose-invert max-w-none">
        <IntroDoc />
      </div>
    </div>
  </PageContainer>
);

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/projects/doom64', element: <Doom64 /> },
  { path: '/projects/sw-timeline', element: <SwTimeline /> },
  { path: '/docs', element: <Docs /> }
]);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
