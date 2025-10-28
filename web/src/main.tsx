import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Link, useLocation } from 'react-router-dom';
import { PageContainer, NeonText } from '@jpfig/ui';
import './index.css';

// Header Component
const Header: React.FC = () => (
  <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700 px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-neon to-magenta rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-xl">JF</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">João Figueredo</h1>
          <p className="text-slate-400 text-sm">Software Developer & Tech Enthusiast</p>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-6 text-sm">
        <a href="https://github.com/jpfigueredo" className="text-slate-400 hover:text-neon transition-colors">
          GitHub
        </a>
        <a href="https://linkedin.com/in/jpfigueredo" className="text-slate-400 hover:text-neon transition-colors">
          LinkedIn
        </a>
        <a href="mailto:jp.figueredo8@gmail.com" className="text-slate-400 hover:text-neon transition-colors">
          Contact
        </a>
      </div>
    </div>
  </header>
);

// Collapsible Sidebar Component
const SidebarMenu: React.FC<{ isCollapsed: boolean; onToggle: () => void }> = ({ isCollapsed, onToggle }) => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Início', icon: '🏠' },
    { path: '/projects/goom64', label: 'GOOM64', icon: '🎮' },
    { path: '/projects/sw-timeline', label: 'SW Timeline', icon: '📊' },
  ];

  return (
    <aside className={`bg-slate-900/80 backdrop-blur-sm border-r border-slate-700 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="p-4">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-neon transition-colors"
        >
          <span className="text-xl">{isCollapsed ? '☰' : '✕'}</span>
        </button>
      </div>
      
      <nav className="px-4 pb-4">
        <div className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                location.pathname === item.path
                  ? 'bg-neon/20 text-neon border border-neon/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>
    </aside>
  );
};

// Enhanced Iframe Component with Fullscreen
const IframeViewport: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={toggleFullscreen}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            ✕ Exit Fullscreen
          </button>
        </div>
        <iframe 
          title={title} 
          src={src} 
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={toggleFullscreen}
          className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
        >
          ⛶ Fullscreen
        </button>
      </div>
      <iframe 
        title={title} 
        src={src} 
        className="w-full h-[80vh] border border-slate-600 rounded-lg"
      />
    </div>
  );
};

// Footer Component
const Footer: React.FC = () => (
  <footer className="bg-slate-900/50 backdrop-blur-sm border-t border-slate-700 px-6 py-8">
    <div className="max-w-6xl mx-auto">
      <div className="grid md:grid-cols-3 gap-8">
        <div>
          <h3 className="text-white font-semibold mb-4">Documentation</h3>
          <div className="space-y-2">
            <Link to="/docs" className="block text-slate-400 hover:text-neon transition-colors">
              Project Documentation
            </Link>
            <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
              API Reference
            </a>
            <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
              Contributing Guide
            </a>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-semibold mb-4">Legal</h3>
          <div className="space-y-2">
            <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
              MIT License
            </a>
            <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-semibold mb-4">Connect</h3>
          <div className="space-y-2">
            <a href="https://github.com/jpfigueredo" className="block text-slate-400 hover:text-neon transition-colors">
              GitHub
            </a>
            <a href="https://linkedin.com/in/jpfigueredo" className="block text-slate-400 hover:text-neon transition-colors">
              LinkedIn
            </a>
            <a href="mailto:jp.figueredo8@gmail.com" className="block text-slate-400 hover:text-neon transition-colors">
              Email
            </a>
          </div>
        </div>
      </div>
      
      <div className="border-t border-slate-700 mt-8 pt-6 text-center">
        <p className="text-slate-400 text-sm">
          © 2024 João Figueredo. Built with React, TypeScript & Tailwind CSS.
        </p>
        <p className="text-slate-500 text-xs mt-2">
          Powered by GitHub Pages • Hosted on Cloudflare Edge
        </p>
      </div>
    </div>
  </footer>
);

// Enhanced Homepage Component
const Home = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    {/* Hero Section */}
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      
      <div className="relative max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-neon to-magenta rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">JF</span>
            </div>
            <div className="text-left">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">
                João <span className="text-neon">Figueredo</span>
              </h1>
              <p className="text-xl text-slate-400">Software Developer & Tech Enthusiast</p>
            </div>
          </div>
          
          <p className="text-lg text-slate-300 max-w-3xl mx-auto mb-8">
            Desenvolvedor apaixonado por tecnologia, especializado em criar soluções inovadoras 
            que combinam performance, usabilidade e design moderno. Explorando as fronteiras 
            entre desenvolvimento web, jogos e visualização de dados.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <span className="px-4 py-2 bg-neon/20 text-neon rounded-full text-sm font-medium">React</span>
            <span className="px-4 py-2 bg-magenta/20 text-magenta rounded-full text-sm font-medium">TypeScript</span>
            <span className="px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">Go</span>
            <span className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">WebAssembly</span>
            <span className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-full text-sm font-medium">Node.js</span>
          </div>
        </div>
        
        {/* Featured Projects */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-neon/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🎮</span>
              <h3 className="text-xl font-semibold text-white">GOOM64</h3>
            </div>
            <p className="text-slate-400 mb-4">
              Um remake do clássico DOOM64 desenvolvido em Go e compilado para WebAssembly. 
              Demonstra habilidades em programação de sistemas, otimização de performance e desenvolvimento de jogos.
            </p>
            <Link 
              to="/projects/goom64" 
              className="inline-flex items-center gap-2 text-neon hover:text-neon/80 transition-colors"
            >
              Ver Projeto <span className="text-lg">→</span>
            </Link>
          </div>
          
          <div className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 hover:border-neon/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">📊</span>
              <h3 className="text-xl font-semibold text-white">SW Timeline</h3>
            </div>
            <p className="text-slate-400 mb-4">
              Linha do tempo interativa da Engenharia de Software, conectando padrões, 
              anti-padrões e paradigmas através de fontes primárias e visualizações em constelações.
            </p>
            <Link 
              to="/projects/sw-timeline" 
              className="inline-flex items-center gap-2 text-neon hover:text-neon/80 transition-colors"
            >
              Ver Projeto <span className="text-lg">→</span>
            </Link>
          </div>
        </div>
        
        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          <div className="text-center">
            <div className="text-3xl font-bold text-neon mb-2">5+</div>
            <div className="text-slate-400 text-sm">Anos de Experiência</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-magenta mb-2">20+</div>
            <div className="text-slate-400 text-sm">Projetos Concluídos</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400 mb-2">10+</div>
            <div className="text-slate-400 text-sm">Tecnologias</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">100%</div>
            <div className="text-slate-400 text-sm">Dedicação</div>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Pronto para colaborar?</h2>
          <p className="text-slate-400 mb-6">
            Vamos criar algo incrível juntos. Entre em contato para discutir seu próximo projeto.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href="mailto:jp.figueredo8@gmail.com"
              className="px-6 py-3 bg-neon text-black font-semibold rounded-lg hover:bg-neon/90 transition-colors"
            >
              Enviar Email
            </a>
            <a 
              href="https://github.com/jpfigueredo"
              className="px-6 py-3 border border-slate-600 text-white font-semibold rounded-lg hover:border-neon hover:text-neon transition-colors"
            >
              Ver GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>
);

// Main Layout Component
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      <div className="flex">
        <SidebarMenu 
          isCollapsed={isSidebarCollapsed} 
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        />
        <main className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-0' : ''}`}>
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
};

const Goom64 = () => (
  <MainLayout>
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          <span className="text-neon">GOOM64</span> (Go + WASM)
        </h1>
        <p className="text-slate-400">
          Um remake do clássico DOOM64 desenvolvido em Go e compilado para WebAssembly. 
          Demonstra habilidades em programação de sistemas e otimização de performance.
        </p>
      </div>
      <IframeViewport src="https://jpfigueredo.github.io/jpfigueredo.github-portfolio-projects/goom64/index.html" title="goom64" />
    </div>
  </MainLayout>
);

const SwTimeline = () => (
  <MainLayout>
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          <span className="text-neon">SW Timeline</span>
        </h1>
        <p className="text-slate-400">
          Linha do tempo interativa da Engenharia de Software, conectando padrões, 
          anti-padrões e paradigmas através de fontes primárias e visualizações em constelações.
        </p>
      </div>
      <IframeViewport src="/apps/sw-timeline/index.html" title="sw-timeline" />
    </div>
  </MainLayout>
);

import IntroDoc from './docs/intro.mdx';
const Docs = () => (
  <MainLayout>
    <div className="p-6 max-w-4xl mx-auto">
      <div className="prose prose-invert max-w-none">
        <IntroDoc />
      </div>
    </div>
  </MainLayout>
);

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/projects/goom64', element: <Goom64 /> },
  { path: '/projects/sw-timeline', element: <SwTimeline /> },
  { path: '/docs', element: <Docs /> }
]);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
