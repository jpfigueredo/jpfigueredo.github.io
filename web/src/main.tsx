import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageContainer, NeonText } from '@jpfig/ui';
import { apps as configApps, version as configVersion } from '@jpfig/config';
import { StarfieldSVG } from './components/StarfieldSVG';
import { ConstellationTimeline } from './components/timeline/ConstellationTimeline';
import { SearchBar } from './components/timeline/SearchBar';
import type { SearchMode } from './components/timeline/SearchBar';
import { LanguageSelector } from './components/LanguageSelector';
import './index.css';
import './i18n/config';

// Header Component
const Header: React.FC<{ onMenuToggle: () => void }> = ({ onMenuToggle }) => {
  const { t } = useTranslation();
  
  return (
    <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 text-slate-400 hover:text-neon transition-colors"
            aria-label={t('common.toggleMenu')}
          >
            <span className="text-2xl">☰</span>
          </button>
          
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-neon to-magenta rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg sm:text-xl">JF</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl sm:text-2xl font-bold text-white">{t('header.title')}</h1>
            <p className="text-slate-400 text-xs sm:text-sm">{t('header.subtitle')}</p>
          </div>
          <div className="sm:hidden">
            <h1 className="text-base font-bold text-white">{t('header.shortTitle')}</h1>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm">
          <LanguageSelector />
          <a href="https://github.com/jpfigueredo" className="text-slate-400 hover:text-neon transition-colors">
            GitHub
          </a>
          <a href="https://linkedin.com/in/jpfigueredo" className="text-slate-400 hover:text-neon transition-colors">
            LinkedIn
          </a>
          <a href="mailto:jp.figueredo8@gmail.com" className="text-slate-400 hover:text-neon transition-colors">
            {t('header.contact')}
          </a>
        </div>
        {/* Mobile social links */}
        <div className="md:hidden flex items-center gap-3">
          <LanguageSelector />
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
};

// Collapsible Sidebar Component
const SidebarMenu: React.FC<{ isCollapsed: boolean; isMobileOpen: boolean; onToggle: () => void }> = ({ isCollapsed, isMobileOpen, onToggle }) => {
  const location = useLocation();
  const { t } = useTranslation();
  
  const navItems = [
    { path: '/', label: t('nav.home'), icon: '🏠' },
    { path: '/projects/sw-timeline', label: t('nav.swTimeline'), icon: '🌳' },
    { path: '/projects/kafka-viz', label: t('nav.kafkaViz'), icon: '📡' },
    { path: '/projects/angular-demo', label: t('nav.angularDemo'), icon: '🅰' },
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
            aria-label={t('common.closeMenu')}
          >
            <span className="text-xl">✕</span>
          </button>
          <button
            onClick={onToggle}
            className="hidden md:flex w-full items-center justify-center p-2 text-slate-400 hover:text-neon transition-colors"
            aria-label={t('common.toggleMenu')}
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
  const { t } = useTranslation();

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
            aria-label={t('common.exitFullscreen')}
          >
            ✕ {t('common.exitFullscreen')}
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
          aria-label={t('common.enterFullscreen')}
        >
          ⛶ {t('common.enterFullscreen')}
        </button>
      </div>
      <iframe 
        title={title} 
        src={src} 
        className="w-full h-[78vh] sm:h-[82vh] md:h-[86vh] min-h-[520px] border border-slate-600 rounded-lg"
        allowFullScreen
      />
    </div>
  );
};

// Footer Component
const Footer: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <footer className="bg-slate-900/50 backdrop-blur-sm border-t border-slate-700 px-4 sm:px-6 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
          <div>
            <h3 className="text-white font-semibold mb-4">{t('footer.documentation')}</h3>
            <div className="space-y-2">
              <Link to="/docs" className="block text-slate-400 hover:text-neon transition-colors">
                {t('footer.projectDocs')}
              </Link>
              <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
                {t('footer.apiReference')}
              </a>
              <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
                {t('footer.contributing')}
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-semibold mb-4">{t('footer.legal')}</h3>
            <div className="space-y-2">
              <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
                {t('footer.license')}
              </a>
              <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
                {t('footer.privacy')}
              </a>
              <a href="#" className="block text-slate-400 hover:text-neon transition-colors">
                {t('footer.terms')}
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-white font-semibold mb-4">{t('footer.connect')}</h3>
            <div className="space-y-2">
              <a href="https://github.com/jpfigueredo" className="block text-slate-400 hover:text-neon transition-colors">
                GitHub
              </a>
              <a href="https://linkedin.com/in/jpfigueredo" className="block text-slate-400 hover:text-neon transition-colors">
                LinkedIn
              </a>
              <a href="mailto:jp.figueredo8@gmail.com" className="block text-slate-400 hover:text-neon transition-colors">
                {t('common.email')}
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t border-slate-700 mt-8 pt-6 text-center">
          <p className="text-slate-400 text-sm">
            {t('footer.copyright')}
          </p>
          <p className="text-slate-500 text-xs mt-2">
            {t('footer.poweredBy')}
          </p>
        </div>
      </div>
    </footer>
  );
};

// Enhanced Homepage Component
const PROJECTS = [
  { key: 'swTimeline', to: '/projects/sw-timeline', accent: '#2563EB', icon: '🌳', stack: ['React', 'TypeScript', 'DAG', 'Vitest'], src: configApps.ohara.iframeSrcProd },
  { key: 'kafkaViz', to: '/projects/kafka-viz', accent: '#F97316', icon: '📡', stack: ['React', 'TypeScript', 'Canvas'], src: configApps.kafkaViz.iframeSrcProd },
  { key: 'angularDemo', to: '/projects/angular-demo', accent: '#94A388', icon: '🅰', stack: ['Angular 17', 'Signals', 'RxJS'], src: configApps.angularDemo.iframeSrcProd },
] as const;

const STACK = ['Java', 'Kotlin', 'Spring', 'Kafka', 'Go', 'React', 'TypeScript', 'Kubernetes', 'AWS'];

// Preview vivo do app rodando em modo default (read-only). Lazy-load (IntersectionObserver)
// + spinner até carregar. Escala 0.5 (iframe 2×) pra virar um "thumbnail" do app real.
const LivePreview: React.FC<{ src: string; label: string }> = ({ src, label }) => {
  const [loaded, setLoaded] = React.useState(false);
  const [inView, setInView] = React.useState(false);
  const boxRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '250px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={boxRef} className="preview-viewport">
      {!loaded && (
        <div className="preview-skeleton">
          <span className="preview-spin" aria-hidden="true" />
        </div>
      )}
      {inView && (
        <iframe
          src={src}
          title={label}
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
          scrolling="no"
          onLoad={() => setLoaded(true)}
          className="preview-frame"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
    </div>
  );
};

// Card = "janela" com o app rodando de verdade (não editável). Spotlight segue o cursor;
// clique em qualquer ponto abre o app completo (com menu/controles).
const ProjectCard: React.FC<{ p: (typeof PROJECTS)[number] }> = ({ p }) => {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLAnchorElement>(null);
  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  const title = t(`home.${p.key}.title`);
  return (
    <Link
      ref={ref}
      to={p.to}
      onMouseMove={handleMove}
      aria-label={`${title} — ${t('home.viewLive')}`}
      className="spotlight-card group block rounded-xl border border-[#1c2436] bg-[#0b111e] overflow-hidden shadow-xl shadow-black/30 hover:border-[color:var(--pc)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pc)]"
      style={{ ['--pc' as string]: p.accent } as React.CSSProperties}
    >
      <span className="spotlight" aria-hidden="true" />
      <div className="relative z-10">
        <div className="preview-chrome">
          <span className="preview-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="preview-chrome__label">
            {p.icon} {title.toLowerCase()}
          </span>
          <span className="preview-chrome__cta" style={{ color: p.accent }}>
            {t('home.viewLive')} →
          </span>
        </div>
        <LivePreview src={p.src} label={title} />
      </div>
    </Link>
  );
};

// Bloco de texto rico: motivação + as -ilities (Kleppmann) que cada projeto demonstra.
const ProjectDescription: React.FC<{ p: (typeof PROJECTS)[number]; index: number }> = ({ p, index }) => {
  const { t } = useTranslation();
  const highlights = t(`home.${p.key}.highlights`, { returnObjects: true }) as unknown as string[];
  return (
    <div>
      <p className="font-mono text-xs tracking-[0.2em] uppercase mb-2" style={{ color: p.accent }}>
        {t('home.projectLabel')} {String(index + 1).padStart(2, '0')}
      </p>
      <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">{t(`home.${p.key}.title`)}</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {p.stack.map((s) => (
          <span key={s} className="px-2.5 py-1 rounded-md border border-[#1c2436] text-[#94A388] text-xs font-mono">
            {s}
          </span>
        ))}
      </div>
      <p className="text-[#c9c1b0] leading-relaxed mb-5">{t(`home.${p.key}.blurb`)}</p>
      <ul className="space-y-2 mb-6">
        {Array.isArray(highlights) &&
          highlights.map((h) => (
            <li key={h} className="flex items-start gap-2.5 text-sm text-[#d8d2c4]">
              <span className="mt-0.5 shrink-0" style={{ color: p.accent }} aria-hidden="true">✓</span>
              <span>{h}</span>
            </li>
          ))}
      </ul>
      <Link to={p.to} className="inline-flex items-center gap-2 font-semibold group/link" style={{ color: p.accent }}>
        {t('home.explore')}
        <span className="transition-transform group-hover/link:translate-x-1">→</span>
      </Link>
    </div>
  );
};

const Home = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-[#F5F1E8] relative overflow-hidden">
      <div className="opacity-40">
        <StarfieldSVG density={70} showConstellations={false} />
      </div>

      <div className="fixed top-4 right-4" style={{ zIndex: 10000 }}>
        <LanguageSelector />
      </div>

      <main className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8">
        {/* Hero */}
        <section className="pt-24 sm:pt-32 pb-16 sm:pb-24">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-[#F97316] mb-4">
            Senior Software Engineer · Sistemas Distribuídos
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold leading-[1.05] tracking-tight mb-5">
            João Pedro<br />
            <span className="gradient-name">Figueredo</span>
          </h1>
          <p className="text-lg sm:text-2xl text-[#94A388] italic mb-8">
            &ldquo;Understand the past. Build the future.&rdquo;
          </p>
          <p className="text-base sm:text-lg text-[#c9c1b0] max-w-2xl mb-10">
            {t('home.description')}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:jp.figueredo8@gmail.com"
              className="px-6 py-3 bg-[#2563EB] text-white font-semibold rounded-lg hover:opacity-90 transition"
            >
              Contato
            </a>
            <a
              href="https://github.com/jpfigueredo"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 border border-[#26314a] text-[#F5F1E8] font-semibold rounded-lg hover:border-[#F97316] transition"
            >
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/jpfigueredo"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 border border-[#26314a] text-[#F5F1E8] font-semibold rounded-lg hover:border-[#F97316] transition"
            >
              LinkedIn
            </a>
          </div>
        </section>

        {/* Projetos — zig-zag: preview de um lado, descrição rica do outro (alterna) */}
        <section className="pb-20 sm:pb-28">
          <h2 className="text-sm font-mono tracking-[0.14em] uppercase text-[#94A388] mb-10">
            {t('home.projectsTitle')}
          </h2>
          <div className="space-y-16 sm:space-y-24">
            {PROJECTS.map((p, i) => (
              <div key={p.key} className="grid md:grid-cols-2 gap-8 md:gap-14 items-center">
                <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                  <ProjectCard p={p} />
                </div>
                <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                  <ProjectDescription p={p} index={i} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section className="pb-20">
          <h2 className="text-sm font-mono tracking-[0.14em] uppercase text-[#94A388] mb-4">Stack</h2>
          <div className="flex flex-wrap gap-2">
            {STACK.map((s) => (
              <span
                key={s}
                className="px-3 py-1.5 rounded-full border border-[#1c2436] text-[#c9c1b0] text-sm font-mono"
              >
                {s}
              </span>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#1c2436] py-8 text-[#94A388] text-sm flex flex-col sm:flex-row gap-2 sm:justify-between">
          <span>© 2026 João Pedro Figueredo</span>
          <span className="flex gap-4">
            <a className="hover:text-[#F97316]" href="https://github.com/jpfigueredo" target="_blank" rel="noreferrer">GitHub</a>
            <a className="hover:text-[#F97316]" href="https://linkedin.com/in/jpfigueredo" target="_blank" rel="noreferrer">LinkedIn</a>
            <a className="hover:text-[#F97316]" href="mailto:jp.figueredo8@gmail.com">Email</a>
          </span>
        </footer>
      </main>
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

const SwTimeline = () => {
  const [q, setQ] = React.useState('');
  const [mode, setMode] = React.useState<SearchMode>('highlight');
  const { t } = useTranslation();

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            <span className="text-neon">{t('swTimeline.title')}</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            {t('swTimeline.description')}
          </p>
        </div>

        {/* App Ohara — trilhas de leitura sobre fontes primárias */}
        <div className="mt-4">
          <h2 className="text-lg sm:text-xl font-semibold text-white mb-3">
            Ohara
            <span className="ml-2 text-xs align-middle text-slate-400">{configVersion}</span>
          </h2>
          <IframeViewport
            src={configApps.ohara.iframeSrcProd}
            title="Ohara – Trilhas de Leitura"
          />
        </div>
      </div>
    </MainLayout>
  );
};

const KafkaVizPage = () => {
  const { t } = useTranslation();
  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            <span className="text-neon">{t('kafkaViz.title')}</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">{t('kafkaViz.description')}</p>
        </div>
        <IframeViewport src={configApps.kafkaViz.iframeSrcProd} title="Kafka Viz" />
      </div>
    </MainLayout>
  );
};

const AngularDemoPage = () => {
  const { t } = useTranslation();
  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            <span className="text-neon">{t('angularDemo.title')}</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">{t('angularDemo.description')}</p>
        </div>
        <IframeViewport src={configApps.angularDemo.iframeSrcProd} title="Angular Demo – Tech Stack Explorer" />
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
  { path: '/projects/sw-timeline', element: <SwTimeline /> },
  { path: '/projects/kafka-viz', element: <KafkaVizPage /> },
  { path: '/projects/angular-demo', element: <AngularDemoPage /> },
  { path: '/docs', element: <Docs /> }
]);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
