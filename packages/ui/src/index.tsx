import React from 'react';

export const PageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    minHeight: '100dvh',
    background: 'linear-gradient(180deg, #0b0f19 0%, #0e1324 100%)',
    color: '#e2e8f0'
  }}>{children}</div>
);

export const NeonText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{
    color: '#00f0ff',
    textShadow: '0 0 12px rgba(0,240,255,0.8)'
  }}>{children}</span>
);
