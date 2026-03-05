import React from 'react';
import { useTranslation } from 'react-i18next';
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
}> = ({ onPrevYear, onNextYear, showConstellations, setShowConstellations, branchSpacing, setBranchSpacing, years, focusYear, onYearChange }) => {
  const { t } = useTranslation();
  
  return (
    <div className="pointer-events-auto z-20 absolute left-2 bottom-2 flex gap-2 items-center bg-slate-900/90 backdrop-blur-sm p-2 rounded-lg border border-slate-700 shadow-lg">
      <IconButton onClick={onPrevYear}>{t('timeline.controls.past')}</IconButton>
      <IconButton onClick={onNextYear}>{t('timeline.controls.future')}</IconButton>
      <Toggle label={t('timeline.controls.constellations')} checked={showConstellations} onChange={setShowConstellations} />
      <Range label={t('timeline.controls.spacing')} min={24} max={96} value={branchSpacing} onChange={setBranchSpacing} />
      {years && (
        <Range label={t('timeline.controls.year')} min={years[0]} max={years[1]} value={focusYear ?? years[0]} onChange={onYearChange}>
          <span className="tabular-nums">{focusYear ?? years[0]}</span>
        </Range>
      )}
    </div>
  );
};


