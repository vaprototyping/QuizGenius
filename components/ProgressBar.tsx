import React from 'react';

interface ProgressBarProps {
  progress: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full bg-slate-200 rounded-full h-4 dark:bg-slate-700 overflow-hidden shadow-inner">
      <div
        className="bg-indigo-600 h-4 rounded-full transition-all duration-300 ease-linear"
        style={{ width: `${clampedProgress}%` }}
        role="progressbar"
        aria-valuenow={clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      ></div>
    </div>
  );
};
