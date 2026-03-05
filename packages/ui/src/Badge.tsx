import React from 'react';

type Variant = 'neon' | 'magenta' | 'neutral' | 'success' | 'warn';

type Props = {
  variant?: Variant;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

const variantStyles: Record<Variant, React.CSSProperties> = {
  neon: {
    color: 'var(--ds-neon, #00e5ff)',
    background: 'rgba(0, 229, 255, 0.1)',
    borderColor: 'rgba(0, 229, 255, 0.35)',
  },
  magenta: {
    color: 'var(--ds-magenta, #ff00e6)',
    background: 'rgba(255, 0, 230, 0.1)',
    borderColor: 'rgba(255, 0, 230, 0.35)',
  },
  neutral: {
    color: 'var(--ds-text-secondary, #9ca3af)',
    background: 'rgba(148, 163, 184, 0.08)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  success: {
    color: '#4ade80',
    background: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  warn: {
    color: '#fbbf24',
    background: 'rgba(251, 191, 36, 0.1)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
};

const baseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  border: '1px solid transparent',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.03em',
};

export const Badge: React.FC<Props> = ({ variant = 'neutral', children, style }) => (
  <span style={{ ...baseStyle, ...variantStyles[variant], ...style }}>
    {children}
  </span>
);
