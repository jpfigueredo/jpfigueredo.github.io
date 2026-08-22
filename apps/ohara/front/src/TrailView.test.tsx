import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TrailView } from './TrailView';
import trailData from './data/seed.distributed-systems.json';
import type { Trail } from './types';

const trail = trailData as unknown as Trail;

describe('TrailView', () => {
  it('renderiza o título da trilha', () => {
    render(<TrailView trail={trail} />);
    expect(screen.getByText(trail.trail.title)).toBeInTheDocument();
  });

  it('renderiza um nó conhecido do acervo verificado', () => {
    render(<TrailView trail={trail} />);
    expect(screen.getByText('Domain-Driven Design')).toBeInTheDocument();
  });

  it('marca exatamente as 5 fontes livres verificadas', () => {
    render(<TrailView trail={trail} />);
    // Lamport, MapReduce, Dynamo, Fielding/REST, Raft — as 5 com URL livre validada
    expect(screen.getAllByText('fonte livre')).toHaveLength(5);
  });
});
