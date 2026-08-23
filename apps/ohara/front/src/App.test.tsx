import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renderiza o título da trilha e um nó conhecido', () => {
    render(<App />);
    expect(
      screen.getByText('Sistemas Distribuídos & Arquitetura de Software'),
    ).toBeInTheDocument();
    expect(screen.getByText('Domain-Driven Design')).toBeInTheDocument();
  });
});
