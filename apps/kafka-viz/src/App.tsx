import React from 'react';
import { KafkaCanvas } from './components/KafkaCanvas';
import { ControlPanel } from './controls/ControlPanel';
import { tickSimulator, buildInitialState } from './engine/simulator';
import { defaultScenario, scenarios } from './engine/scenarios';
import type { Scenario, SimulatorState } from './engine/types';

const TICK_INTERVAL_MS = 120;

export default function App() {
  const [scenarioId, setScenarioId] = React.useState(defaultScenario.id);
  const [simState, setSimState] = React.useState<SimulatorState>(() =>
    buildInitialState(defaultScenario.initialState, 1)
  );

  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSimState(prev => tickSimulator(prev));
    }, TICK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleTogglePause = () => {
    setSimState(prev => ({ ...prev, paused: !prev.paused }));
  };

  const handleSpeedChange = (speed: number) => {
    setSimState(prev => ({ ...prev, speed }));
  };

  const handleScenarioChange = (scenario: Scenario) => {
    setScenarioId(scenario.id);
    setSimState(buildInitialState(scenario.initialState, simState.speed));
  };

  const currentScenario = scenarios.find(s => s.id === scenarioId) ?? defaultScenario;

  return (
    <div className="kv-app">
      <header className="kv-header">
        <div>
          <div className="kv-header__title">Kafka Viz</div>
          <div className="kv-header__subtitle">
            Simulação visual de um cluster Apache Kafka — tick #{simState.tick}
          </div>
        </div>
      </header>

      <div className="kv-canvas-container">
        <KafkaCanvas state={simState} />
      </div>

      <ControlPanel
        paused={simState.paused}
        speed={simState.speed}
        scenarioId={currentScenario.id}
        onTogglePause={handleTogglePause}
        onSpeedChange={handleSpeedChange}
        onScenarioChange={handleScenarioChange}
      />

      <div className="kv-legend">
        <div className="kv-legend__item">
          <span className="kv-legend__dot kv-legend__dot--sending" />
          enviando
        </div>
        <div className="kv-legend__item">
          <span className="kv-legend__dot kv-legend__dot--stored" />
          armazenado
        </div>
        <div className="kv-legend__item">
          <span className="kv-legend__dot kv-legend__dot--consuming" />
          consumindo
        </div>
      </div>
    </div>
  );
}
