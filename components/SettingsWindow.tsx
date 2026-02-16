import React from 'react';
import { X, Moon, Sun, Monitor } from 'lucide-react';
import { Theme } from '../types';

interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 transform transition-all scale-100">
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Configuración</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Theme Section */}
          <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Apariencia</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onThemeChange('light')}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                  theme === 'light'
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                }`}
              >
                <Sun size={20} />
                <span className="text-xs font-medium">Claro</span>
              </button>

              <button
                onClick={() => onThemeChange('dark')}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                  theme === 'dark'
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                }`}
              >
                <Moon size={20} />
                <span className="text-xs font-medium">Oscuro</span>
              </button>

              <button
                onClick={() => onThemeChange('system')}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                  theme === 'system'
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                }`}
              >
                <Monitor size={20} />
                <span className="text-xs font-medium">Sistema</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
             <p className="text-xs text-center text-slate-400">
               Más configuraciones pronto...
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
