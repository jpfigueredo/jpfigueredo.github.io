import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { PageContainer, NeonText } from '@jpfig/ui';
import './index.css';
const IframeViewport = ({ src, title }) => (_jsx("iframe", { title: title, src: src, style: { width: '100%', height: '80vh', border: '1px solid #223', borderRadius: 8 } }));
const SidebarMenu = () => (_jsx("aside", { className: "p-4 border-r border-slate-700 min-w-[220px]", children: _jsxs("nav", { className: "flex flex-col gap-2", children: [_jsx("a", { className: "text-neon hover:underline", href: "/", children: "In\u00EDcio" }), _jsx("a", { className: "hover:underline", href: "/projects/goom64", children: "GOOM64 (Go + WASM)" }), _jsx("a", { className: "hover:underline", href: "/projects/sw-timeline", children: "SW Timeline" }), _jsx("a", { className: "hover:underline", href: "/docs", children: "Docs" })] }) }));
const Home = () => (_jsx(PageContainer, { children: _jsxs("div", { className: "flex", children: [_jsx(SidebarMenu, {}), _jsxs("div", { className: "p-6", children: [_jsxs("h1", { className: "text-2xl", children: [_jsx(NeonText, { children: "Portfolio" }), " \u2013 jpfigueredo"] }), _jsx("p", { className: "mt-2", children: "Escolha um projeto no menu." })] })] }) }));
const Goom64 = () => (_jsx(PageContainer, { children: _jsxs("div", { className: "flex", children: [_jsx(SidebarMenu, {}), _jsxs("div", { className: "p-6 w-full", children: [_jsx("h2", { children: _jsx(NeonText, { children: "GOOM64 (Go + WASM)" }) }), _jsx(IframeViewport, { src: "https://jpfigueredo.github.io/jpfigueredo.github-portfolio-projects/goom64/index.html", title: "goom64" })] })] }) }));
const SwTimeline = () => (_jsx(PageContainer, { children: _jsxs("div", { className: "flex", children: [_jsx(SidebarMenu, {}), _jsxs("div", { className: "p-6 w-full", children: [_jsx("h2", { children: _jsx(NeonText, { children: "SW Timeline" }) }), _jsx(IframeViewport, { src: "/apps/sw-timeline/index.html", title: "sw-timeline" })] })] }) }));
import IntroDoc from './docs/intro.mdx';
const Docs = () => (_jsx(PageContainer, { children: _jsxs("div", { className: "flex", children: [_jsx(SidebarMenu, {}), _jsx("div", { className: "p-6 prose prose-invert max-w-none", children: _jsx(IntroDoc, {}) })] }) }));
const router = createBrowserRouter([
    { path: '/', element: _jsx(Home, {}) },
    { path: '/projects/goom64', element: _jsx(Goom64, {}) },
    { path: '/projects/sw-timeline', element: _jsx(SwTimeline, {}) },
    { path: '/docs', element: _jsx(Docs, {}) }
]);
createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(RouterProvider, { router: router }) }));
