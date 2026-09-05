import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="p-1.5 rounded bg-field-surface-elevated hover:bg-field-border text-field-primary border border-field-border transition-colors flex items-center justify-center cursor-pointer"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 hover:text-amber-300 transition-colors" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 hover:text-slate-900 transition-colors" />
      )}
    </button>
  );
};
