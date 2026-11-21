import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { OharaHome } from './OharaHome';
import { TRAILS, type TrailCard } from './trails';

const TWO_TRAILS: TrailCard[] = [
  ...TRAILS,
  { id: 'outra-trilha', title: 'Outra Trilha', subtitle: 'só para o teste' },
];

describe('App', () => {
  it('com uma única trilha, abre direto nela e mostra um nó conhecido do acervo', () => {
    render(<App />);
    expect(screen.queryByText('Escolha sua trilha')).not.toBeInTheDocument();
    expect(screen.getByText('Domain-Driven Design')).toBeInTheDocument();
  });

  it('com uma única trilha, não mostra o botão de voltar para as trilhas', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: /trilhas/ })).not.toBeInTheDocument();
  });

  it('com 2 ou mais trilhas, abre na home e volta para ela pelo botão "← trilhas"', () => {
    render(<App trails={TWO_TRAILS} />);
    expect(screen.getByText('Escolha sua trilha')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Arquitetura de Software'));
    expect(screen.getByText('Domain-Driven Design')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /trilhas/ }));
    expect(screen.getByText('Escolha sua trilha')).toBeInTheDocument();
  });
});

describe('OharaHome', () => {
  it('lista só trilhas disponíveis, sem cards "em breve"', () => {
    render(<OharaHome trails={TRAILS} onSelect={() => {}} />);
    expect(screen.getByText('Arquitetura de Software')).toBeInTheDocument();
    expect(screen.getByText('De Turing a Newman · 26 obras')).toBeInTheDocument();
    expect(screen.queryByText('em breve')).not.toBeInTheDocument();
    for (const placeholder of ['Backend Developer', 'DevOps Engineer', 'Cloud Architect']) {
      expect(screen.queryByText(placeholder)).not.toBeInTheDocument();
    }
    expect(screen.getAllByRole('button').every((b) => !b.hasAttribute('disabled'))).toBe(true);
  });

  it('ao escolher uma trilha, informa o id dela', () => {
    const onSelect = vi.fn();
    render(<OharaHome trails={TRAILS} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Arquitetura de Software'));
    expect(onSelect).toHaveBeenCalledWith('distributed-systems-architecture');
  });
});
