import React from 'react';
import { scenarios } from '../engine/scenarios';
import type { Scenario } from '../engine/types';

type Props = {
  paused: boolean;
  speed: number;
  scenarioId: string;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onScenarioChange: (scenario: Scenario) => void;
};

export const ControlPanel: React.FC<Props> = ({
  paused,
  speed,
  scenarioId,
  onTogglePause,
  onSpeedChange,
  onScenarioChange,
}) => {
  return (
    <div className="kv-controls">
      <div className="kv-controls__row">
        <button
          type="button"
          className={`kv-controls__btn kv-controls__btn--play ${paused ? '' : 'kv-controls__btn--active'}`}
          onClick={onTogglePause}
          aria-pressed={!paused}
          aria-label={paused ? 'Iniciar simulação' : 'Pausar simulação'}
        >
          {paused ? '▶ Play' : '⏸ Pause'}
        </button>

        <div className="kv-controls__speed">
          <label htmlFor="kv-speed" className="kv-controls__label">
            Velocidade: {speed}x
          </label>
          <input
            id="kv-speed"
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={speed}
            onChange={e => onSpeedChange(Number(e.target.value))}
            className="kv-controls__range"
          />
        </div>
      </div>

      <div className="kv-controls__scenarios">
        {scenarios.map(scenario => (
          <button
            key={scenario.id}
            type="button"
            className={`kv-controls__scenario-btn ${scenarioId === scenario.id ? 'kv-controls__scenario-btn--active' : ''}`}
            onClick={() => onScenarioChange(scenario)}
            aria-pressed={scenarioId === scenario.id}
            title={scenario.description}
          >
            {scenario.label}
          </button>
        ))}
      </div>

      <div className="kv-controls__hint">
        {scenarios.find(s => s.id === scenarioId)?.description}
      </div>
    </div>
  );
};
