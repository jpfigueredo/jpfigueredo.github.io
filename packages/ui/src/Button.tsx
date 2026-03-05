import React from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const baseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  borderRadius: '0.5rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid transparent',
  transition: 'background 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease',
  userSelect: 'none',
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { fontSize: '0.75rem', padding: '0.25rem 0.75rem' },
  md: { fontSize: '0.875rem', padding: '0.5rem 1.25rem' },
};

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--ds-neon, #00e5ff)',
    color: '#020617',
    borderColor: 'var(--ds-neon, #00e5ff)',
  },
  ghost: {
    background: 'rgba(15, 23, 42, 0.6)',
    color: 'var(--ds-text-primary, #e2e8f0)',
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  danger: {
    background: 'rgba(220, 38, 38, 0.15)',
    color: '#f87171',
    borderColor: 'rgba(220, 38, 38, 0.4)',
  },
};

export const Button: React.FC<Props> = ({
  variant = 'ghost',
  size = 'md',
  style,
  children,
  ...rest
}) => (
  <button
    type="button"
    style={{
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);
