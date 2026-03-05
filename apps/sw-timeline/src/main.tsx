import React from 'react';
import { createRoot } from 'react-dom/client';
import { TimelineShell } from './components/layout/TimelineShell';
import './styles/layout.css';
import './styles/timeline.css';
import './styles/animations.css';

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <TimelineShell />
    </React.StrictMode>
  );
}

