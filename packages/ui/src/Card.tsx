import React from 'react';

type Props = {
  children: React.ReactNode;
  hover?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
};

export const Card: React.FC<Props> = ({ children, hover = false, style, className, onClick }) => {
  const baseStyle: React.CSSProperties = {
    background: 'var(--ds-bg-card, rgba(15, 23, 42, 0.9))',
    border: '1px solid rgba(30, 64, 175, 0.4)',
    borderRadius: '0.75rem',
    padding: '1rem 1.25rem',
    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.9)',
    backdropFilter: 'blur(12px)',
    transition: hover ? 'border-color 160ms ease, box-shadow 160ms ease' : undefined,
    cursor: onClick || hover ? 'pointer' : undefined,
    ...style,
  };

  return (
    <div
      style={baseStyle}
      className={className}
      onClick={onClick}
      onMouseEnter={
        hover
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(56, 189, 248, 0.5)';
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                '0 0 0 1px rgba(56, 189, 248, 0.2), 0 18px 45px rgba(15, 23, 42, 0.9)';
            }
          : undefined
      }
      onMouseLeave={
        hover
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(30, 64, 175, 0.4)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 18px 45px rgba(15, 23, 42, 0.9)';
            }
          : undefined
      }
    >
      {children}
    </div>
  );
};
