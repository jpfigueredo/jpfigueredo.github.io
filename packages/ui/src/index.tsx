import React from 'react';

export { Button } from './Button';
export { Badge } from './Badge';
export { Card } from './Card';

export const PageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    minHeight: '100dvh',
    background: 'linear-gradient(180deg, var(--ds-bg-deep, #070a12) 0%, var(--ds-bg-space, #0a0f1d) 100%)',
    color: 'var(--ds-text-primary, #e2e8f0)',
  }}>
    {children}
  </div>
);

export const NeonText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{
    color: 'var(--ds-neon, #00e5ff)',
    textShadow: '0 0 12px rgba(0, 229, 255, 0.8)',
  }}>
    {children}
  </span>
);
