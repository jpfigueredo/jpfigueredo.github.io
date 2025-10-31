import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Link, useLocation } from 'react-router-dom';
import { PageContainer, NeonText } from '@jpfig/ui';
import { Starfield } from './components/Starfield';
import { ConstellationTimeline } from './components/timeline/ConstellationTimeline';
import { SearchBar } from './components/timeline/SearchBar';
import type { SearchMode } from './components/timeline/SearchBar';
import './index.css';

// Header Component
const Header: React.FC<{ onMenuToggle: () => void }> = ({ onMenuToggle }) => (
  <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-40">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 text-slate-400 hover:text-neon transition-colors"
          aria-label="Toggle menu"
        >
          <span className="text-2xl">☰</span>
        </button>
        
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-neon to-magenta rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg sm:text-xl">JF</span>
        </div>
        <div className="hidden sm:block">
          <h1 className="text-xl sm:text-2xl font-bold text-white">João Figueredo</h1>
          <p className="text-slate-400 text-xs sm:text-sm">Software Developer & Tech Enthusiast</p>
        </div>
        <div className="sm:hidden">
          <h1 className="text-base font-bold text-white">João F.</h1>
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
      {/* Mobile social links */}
      <div className="md:hidden flex items-center gap-3">
        <a href="https://github.com/jpfigueredo" className="text-slate-400 hover:text-neon transition-colors p-2" aria-label="GitHub">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        </a>
        <a href="https://linkedin.com/in/jpfigueredo" className="text-slate-400 hover:text-neon transition-colors p-2" aria-label="LinkedIn">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
        </a>
      </div>
    </div>
  </header>
);

// Collapsible Sidebar Component
const SidebarMenu: React.FC<{ isCollapsed: boolean; isMobileOpen: boolean; onToggle: () => void }> = ({ isCollapsed, isMobileOpen, onToggle }) => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Início', icon: '🏠' },
    { path: '/projects/goom64', label: 'GOOM64', icon: '🎮' },
    { path: '/projects/sw-timeline', label: 'SW Timeline', icon: '📊' },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        bg-slate-900/95 md:bg-slate-900/80 backdrop-blur-sm 
        border-r border-slate-700 
        transition-all duration-300 ease-in-out
        md:translate-x-0
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed && !isMobileOpen ? 'md:w-16' : 'w-64'}
      `}>
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-neon transition-colors md:hidden"
            aria-label="Close menu"
          >
            <span className="text-xl">✕</span>
          </button>
          <button
            onClick={onToggle}
            className="hidden md:flex w-full items-center justify-center p-2 text-slate-400 hover:text-neon transition-colors"
            aria-label="Toggle sidebar"
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
                onClick={() => {
                  // Close mobile menu when navigating
                  if (isMobileOpen) {
                    onToggle();
                  }
                }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                  location.pathname === item.path
                    ? 'bg-neon/20 text-neon border border-neon/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {(!isCollapsed || isMobileOpen) && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            ))}
          </div>
        </nav>
      </aside>
    </>
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
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm sm:text-base"
            aria-label="Exit fullscreen"
          >
            ✕ Exit Fullscreen
          </button>
        </div>
        <iframe 
          title={title} 
          src={src} 
          className="w-full h-full border-0"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
        <button
          onClick={toggleFullscreen}
          className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
          aria-label="Enter fullscreen"
        >
          ⛶ Fullscreen
        </button>
      </div>
      <iframe 
        title={title} 
        src={src} 
        className="w-full h-[60vh] sm:h-[70vh] md:h-[80vh] border border-slate-600 rounded-lg"
        allowFullScreen
      />
    </div>
  );
};

// Footer Component
const Footer: React.FC = () => (
  <footer className="bg-slate-900/50 backdrop-blur-sm border-t border-slate-700 px-4 sm:px-6 py-6 sm:py-8">
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
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
const Home = () => {
  const [showHubbleOverlay, setShowHubbleOverlay] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
      <Starfield density={280} showConstellations={true} />
      {/* Hero Section */}
      <section className="relative z-10 overflow-hidden">
        {/* Hubble overlay with high contrast - can be toggled */}
        {showHubbleOverlay && (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12] mix-blend-screen bg-center bg-cover transition-opacity duration-500"
            style={{
              backgroundImage:
                "url('https://upload.wikimedia.org/wikipedia/commons/3/3f/2014_Hubble_Ultra_Deep_Field_%28full_resolution%29.png')",
              filter: 'contrast(1.8) brightness(0.4) saturate(0.6)',
            }}
            aria-hidden="true"
          />
        )}
        
        {/* Toggle button for Hubble overlay */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setShowHubbleOverlay(!showHubbleOverlay)}
            className="px-3 py-2 bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-lg text-slate-400 hover:text-neon hover:border-neon/50 transition-all text-xs sm:text-sm flex items-center gap-2"
            title={showHubbleOverlay ? 'Ocultar galáxias' : 'Mostrar galáxias'}
          >
            <span>{showHubbleOverlay ? '🌌' : '🌌'}</span>
            <span className="hidden sm:inline">{showHubbleOverlay ? 'Ocultar' : 'Mostrar'}</span>
          </button>
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-neon to-magenta rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-2xl sm:text-3xl">JF</span>
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2">
                João <span className="text-neon">Figueredo</span>
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-slate-400">Software Developer & Tech Enthusiast</p>
            </div>
          </div>
          
          <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-3xl mx-auto mb-6 sm:mb-8 px-4">
            Desenvolvedor apaixonado por tecnologia, especializado em criar soluções inovadoras 
            que combinam performance, usabilidade e design moderno. Explorando as fronteiras 
            entre desenvolvimento web, jogos e visualização de dados.
          </p>
          
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 mb-8 sm:mb-12 px-4">
            <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-neon/20 text-neon rounded-full text-xs sm:text-sm font-medium">React</span>
            <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-magenta/20 text-magenta rounded-full text-xs sm:text-sm font-medium">TypeScript</span>
            <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-500/20 text-green-400 rounded-full text-xs sm:text-sm font-medium">Go</span>
            <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500/20 text-blue-400 rounded-full text-xs sm:text-sm font-medium">WebAssembly</span>
            <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-500/20 text-purple-400 rounded-full text-xs sm:text-sm font-medium">Node.js</span>
          </div>
        </div>
        
        {/* Featured Projects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-12 sm:mb-16">
          <div className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 sm:p-6 hover:border-neon/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <span className="text-2xl sm:text-3xl">🎮</span>
              <h3 className="text-lg sm:text-xl font-semibold text-white">GOOM64</h3>
            </div>
            <p className="text-slate-400 text-sm sm:text-base mb-4">
              Um remake do clássico DOOM64 desenvolvido em Go e compilado para WebAssembly. 
              Demonstra habilidades em programação de sistemas, otimização de performance e desenvolvimento de jogos.
            </p>
            <Link 
              to="/projects/goom64" 
              className="inline-flex items-center gap-2 text-neon hover:text-neon/80 transition-colors text-sm sm:text-base"
            >
              Ver Projeto <span className="text-lg">→</span>
            </Link>
          </div>
          
          <div className="group bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4 sm:p-6 hover:border-neon/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <span className="text-2xl sm:text-3xl">📊</span>
              <h3 className="text-lg sm:text-xl font-semibold text-white">SW Timeline</h3>
            </div>
            <p className="text-slate-400 text-sm sm:text-base mb-4">
              Linha do tempo interativa da Engenharia de Software, conectando padrões, 
              anti-padrões e paradigmas através de fontes primárias e visualizações em constelações.
            </p>
            <Link 
              to="/projects/sw-timeline" 
              className="inline-flex items-center gap-2 text-neon hover:text-neon/80 transition-colors text-sm sm:text-base"
            >
              Ver Projeto <span className="text-lg">→</span>
            </Link>
          </div>
        </div>
        
        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-16 px-4">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-neon mb-1 sm:mb-2">5+</div>
            <div className="text-slate-400 text-xs sm:text-sm">Anos de Experiência</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-magenta mb-1 sm:mb-2">20+</div>
            <div className="text-slate-400 text-xs sm:text-sm">Projetos Concluídos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-green-400 mb-1 sm:mb-2">10+</div>
            <div className="text-slate-400 text-xs sm:text-sm">Tecnologias</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-blue-400 mb-1 sm:mb-2">100%</div>
            <div className="text-slate-400 text-xs sm:text-sm">Dedicação</div>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="text-center px-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Pronto para colaborar?</h2>
          <p className="text-sm sm:text-base text-slate-400 mb-4 sm:mb-6">
            Vamos criar algo incrível juntos. Entre em contato para discutir seu próximo projeto.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
            <a 
              href="mailto:jp.figueredo8@gmail.com"
              className="px-5 sm:px-6 py-2.5 sm:py-3 bg-neon text-black font-semibold rounded-lg hover:bg-neon/90 transition-colors text-sm sm:text-base"
            >
              Enviar Email
            </a>
            <a 
              href="https://github.com/jpfigueredo"
              className="px-5 sm:px-6 py-2.5 sm:py-3 border border-slate-600 text-white font-semibold rounded-lg hover:border-neon hover:text-neon transition-colors text-sm sm:text-base"
            >
              Ver GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  </div>
  );
};

// Main Layout Component
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    if (window.innerWidth >= 768) {
      // Desktop: toggle sidebar collapse
      setIsSidebarCollapsed(!isSidebarCollapsed);
    } else {
      // Mobile: toggle mobile menu
      setIsMobileMenuOpen(!isMobileMenuOpen);
    }
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header onMenuToggle={handleMenuToggle} />
      <div className="flex relative">
        <SidebarMenu 
          isCollapsed={isSidebarCollapsed} 
          isMobileOpen={isMobileMenuOpen}
          onToggle={() => {
            if (window.innerWidth >= 768) {
              setIsSidebarCollapsed(!isSidebarCollapsed);
            } else {
              setIsMobileMenuOpen(!isMobileMenuOpen);
            }
          }} 
        />
        <main className={`flex-1 transition-all duration-300 min-w-0 ${isSidebarCollapsed && !isMobileMenuOpen ? 'md:ml-0' : ''}`}>
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
};

const Goom64 = () => (
  <MainLayout>
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          <span className="text-neon">GOOM64</span> <span className="text-slate-400 text-lg sm:text-xl">(Go + WASM)</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base">
          Um remake do clássico DOOM64 desenvolvido em Go e compilado para WebAssembly. 
          Demonstra habilidades em programação de sistemas e otimização de performance.
        </p>
      </div>
      <IframeViewport src="https://jpfigueredo.github.io/jpfigueredo.github-portfolio-projects/goom64/index.html" title="goom64" />
    </div>
  </MainLayout>
);

const SwTimeline = () => {
  const [q, setQ] = React.useState('');
  const [mode, setMode] = React.useState<SearchMode>('highlight');

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            <span className="text-neon">SW Timeline</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Linha do tempo interativa da Engenharia de Software, conectando padrões, 
            anti-padrões e paradigmas através de fontes primárias e visualizações em constelações.
          </p>
        </div>
        <SearchBar value={q} mode={mode} onChange={setQ} onModeChange={setMode} />
        <div className="border border-slate-700 rounded-lg bg-slate-900/40">
          <ConstellationTimeline height={520} query={q} mode={mode} />
        </div>
      </div>
    </MainLayout>
  );
};

import IntroDoc from './docs/intro.mdx';
const Docs = () => (
  <MainLayout>
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="prose prose-invert prose-sm sm:prose-base max-w-none">
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
