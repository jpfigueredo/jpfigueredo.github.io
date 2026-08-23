import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('abre na home com a trilha de arquitetura disponível', () => {
    render(<App />);
    expect(screen.getByText('Escolha sua trilha')).toBeInTheDocument();
    expect(screen.getByText('Arquitetura de Software')).toBeInTheDocument();
  });

  it('ao escolher a trilha, mostra um nó conhecido do acervo', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Arquitetura de Software'));
    expect(screen.getByText('Domain-Driven Design')).toBeInTheDocument();
  });
});
