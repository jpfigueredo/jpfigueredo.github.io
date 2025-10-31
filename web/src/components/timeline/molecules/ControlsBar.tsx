import React from 'react';
import { IconButton } from '../atoms/IconButton';
import { Toggle } from '../atoms/Toggle';
import { Range } from '../atoms/Range';

export const ControlsBar: React.FC<{
  onPrevYear: () => void;
  onNextYear: () => void;
  showConstellations: boolean;
  setShowConstellations: (v: boolean) => void;
  branchSpacing: number;
  setBranchSpacing: (v: number) => void;
  years: [number, number] | null;
  focusYear: number | null;
  onYearChange: (y: number) => void;
}> = ({ onPrevYear, onNextYear, showConstellations, setShowConstellations, branchSpacing, setBranchSpacing, years, focusYear, onYearChange }) => (
  <div className="pointer-events-auto absolute left-2 bottom-2 flex gap-2 items-center">
    <IconButton onClick={onPrevYear}>← Passado</IconButton>
    <IconButton onClick={onNextYear}>Futuro →</IconButton>
    <Toggle label="constelações" checked={showConstellations} onChange={setShowConstellations} />
    <Range label="espaçamento" min={24} max={96} value={branchSpacing} onChange={setBranchSpacing} />
    {years && (
      <Range label="ano" min={years[0]} max={years[1]} value={focusYear ?? years[0]} onChange={onYearChange}>
        <span className="tabular-nums">{focusYear ?? years[0]}</span>
      </Range>
    )}
  </div>
);


