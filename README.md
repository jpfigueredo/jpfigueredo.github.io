# 🚀 João Figueredo - Portfolio Frontend

> **Modern Portfolio Showcase** - A sci-fi/cyberpunk themed portfolio built with React, TypeScript, and modern web technologies.

[![Portfolio](https://img.shields.io/badge/Portfolio-Live-brightgreen?style=for-the-badge&logo=react)](https://jpfigueredo.github.io)
[![Build Status](https://img.shields.io/badge/Build-Passing-success?style=for-the-badge&logo=github-actions)](https://github.com/jpfigueredo/jpfigueredo.github.io/actions)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge&logo=opensourceinitiative)](LICENSE)

## 🎯 Overview

This repository hosts the **frontend portfolio** for João Figueredo, showcasing various applications and projects through an interactive, modern web interface. The portfolio features a sci-fi/cyberpunk aesthetic with responsive design and seamless navigation.

### 🌟 Live Portfolio
**Visit:** [https://jpfigueredo.github.io](https://jpfigueredo.github.io)

## 🏗️ Architecture

### Monorepo Structure
```
jpfigueredo.github.io/
├── web/                    # Main React portfolio app
├── apps/                   # Sub-applications showcase
│   ├── goom64/            # GOOM64 (Go + WASM) game
│   └── sw-timeline/       # Software Engineering Timeline
├── packages/              # Shared components & config
│   ├── ui/               # Reusable UI components
│   └── config/           # Shared configurations
├── services/             # Backend services
│   └── edge-proxy/       # Cloudflare Worker proxy
└── .github/workflows/    # CI/CD pipelines
```

## 🎮 Featured Applications

### 1. **GOOM64** 🎮
- **Technology:** Go + WebAssembly
- **Description:** A remake of the classic DOOM64 game compiled to WebAssembly
- **Features:** 
  - Systems programming expertise
  - Performance optimization
  - Cross-platform game development
- **Live Demo:** [GOOM64 Game](https://jpfigueredo.github.io/projects/goom64)

### 2. **SW Timeline** 📊
- **Technology:** React + D3.js/Three.js
- **Description:** Interactive Software Engineering timeline connecting patterns, anti-patterns, and paradigms
- **Features:**
  - Constellation-like visualizations
  - Primary source citations
  - Interactive knowledge mapping
- **Live Demo:** [SW Timeline](https://jpfigueredo.github.io/projects/sw-timeline)

## 🛠️ Tech Stack

### Frontend
- **React 18** + **TypeScript** - Modern component architecture
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling with custom sci-fi theme
- **React Router** - Client-side routing
- **MDX** - Documentation with embedded components

### Build & Deploy
- **Yarn** + **Turborepo** - Monorepo management and caching
- **GitHub Actions** - CI/CD automation
- **GitHub Pages** - Static hosting
- **Cloudflare Workers** - Edge proxy and API gateway

### Design System
- **Sci-fi/Cyberpunk Theme** with neon accents
- **Responsive Design** - Mobile-first approach
- **Dark Mode** - Optimized for developer experience
- **Smooth Animations** - CSS transitions and micro-interactions

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (LTS)
- Yarn 1.22.22+

### Development
```bash
# Clone the repository
git clone https://github.com/jpfigueredo/jpfigueredo.github.io.git
cd jpfigueredo.github.io

# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

### Available Scripts
```bash
yarn dev          # Start development server
yarn build        # Build all packages
yarn lint         # Run ESLint
yarn typecheck    # Run TypeScript checks
```

## 🎨 Design Features

### Modern UI Components
- **Collapsible Sidebar** - Space-efficient navigation
- **Fullscreen Iframes** - Immersive project viewing
- **Hero Section** - Professional introduction
- **Project Cards** - Interactive showcase
- **Statistics Dashboard** - Visual metrics
- **Contact Forms** - Professional outreach

### Responsive Design
- **Mobile-First** - Optimized for all devices
- **Touch-Friendly** - Gesture support
- **Accessibility** - WCAG compliant
- **Performance** - Optimized bundle size

## 📁 Project Structure

### Main Portfolio (`web/`)
- **Homepage** - Hero section with project highlights
- **Project Pages** - Individual application showcases
- **Documentation** - Technical docs and guides
- **Contact** - Professional contact information

### Sub-Applications (`apps/`)
Each application is built independently and embedded via iframe:
- **GOOM64** - Game development showcase
- **SW Timeline** - Data visualization project

### Shared Packages (`packages/`)
- **UI Components** - Reusable React components
- **Configuration** - Shared ESLint, TypeScript configs
- **Theme System** - Consistent design tokens

## 🔧 Development

### Adding New Projects
1. Create new app in `apps/your-project/`
2. Build static output to `apps/your-project/dist/`
3. Add route in `web/src/main.tsx`
4. Update navigation menu
5. Deploy via GitHub Actions

### Customizing Theme
- Edit `web/src/index.css` for global styles
- Modify `web/tailwind.config.cjs` for design tokens
- Update component styles in `packages/ui/`

## 📊 Performance

- **Bundle Size:** ~218KB JS, ~13KB CSS (gzipped)
- **Build Time:** ~4s with Turborepo caching
- **Lighthouse Score:** 95+ across all metrics
- **Core Web Vitals:** Optimized for user experience

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

**João Figueredo** - Software Developer & Tech Enthusiast

- 📧 Email: [jp.figueredo8@gmail.com](mailto:jp.figueredo8@gmail.com)
- 💼 LinkedIn: [linkedin.com/in/jpfigueredo](https://linkedin.com/in/jpfigueredo)
- 🐙 GitHub: [github.com/jpfigueredo](https://github.com/jpfigueredo)
- 🌐 Portfolio: [jpfigueredo.github.io](https://jpfigueredo.github.io)

---

<div align="center">
  <p>Built with ❤️ using React, TypeScript, and modern web technologies</p>
  <p>⭐ Star this repo if you found it helpful!</p>
</div>
