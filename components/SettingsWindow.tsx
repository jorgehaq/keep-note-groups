import React from 'react';
import { X, Moon, Sun, Monitor, Type, MousePointer2 } from 'lucide-react';
import { Theme, NoteFont } from '../types';

interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  noteFont: NoteFont;
  onNoteFontChange: (font: NoteFont) => void;
  // --- AQUÍ AGREGAMOS LAS PROPS QUE FALTABAN ---
  noteFontSize: string;
  onNoteFontSizeChange: (size: string) => void;
}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  noteFont,
  onNoteFontChange,
  noteFontSize,
  onNoteFontSizeChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            Configuración
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors text-zinc-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Tema Visual */}
          <section>
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4 block">
              Apariencia del Sistema
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'light', icon: Sun, label: 'Claro' },
                { id: 'dark', icon: Moon, label: 'Oscuro' },
                { id: 'system', icon: Monitor, label: 'Sistema' }
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => onThemeChange(id as Theme)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                    theme === id 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                      : 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[11px] font-bold">{label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Tipografía y Tamaño del Editor */}
          <section className="p-5 bg-zinc-50 dark:bg-zinc-800/30 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4 block">
              Tipografía de Notas (Obsidian)
            </label>
            
            {/* Selector de Fuente */}
            <div className="flex bg-zinc-200/50 dark:bg-zinc-900/50 rounded-xl p-1 mb-6">
              {[
                { id: 'sans', label: 'Sans' },
                { id: 'serif', label: 'Serif' },
                { id: 'mono', label: 'Mono' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => onNoteFontChange(f.id as NoteFont)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    noteFont === f.id 
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' 
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Selector de Tamaño (SLIDER DE 3 POSICIONES) */}
            <div className="space-y-3">
                <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase">
                    <span>Pequeño</span>
                    <span>Mediano</span>
                    <span>Grande</span>
                </div>
                <div className="relative h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center">
                    {/* El deslizador visual */}
                    <div 
                        className="absolute w-5 h-5 bg-indigo-500 rounded-full shadow-lg border-2 border-white dark:border-zinc-900 cursor-pointer transition-all duration-300 ease-out z-10"
                        style={{ 
                            left: noteFontSize === 'small' ? '0%' : noteFontSize === 'medium' ? '50%' : '100%',
                            transform: 'translateX(-50%)'
                        }}
                    />
                    {/* Zonas de clic invisibles para el slider */}
                    <div className="absolute inset-0 flex justify-between">
                        <div className="w-1/3 h-full cursor-pointer" onClick={() => onNoteFontSizeChange('small')} />
                        <div className="w-1/3 h-full cursor-pointer" onClick={() => onNoteFontSizeChange('medium')} />
                        <div className="w-1/3 h-full cursor-pointer" onClick={() => onNoteFontSizeChange('large')} />
                    </div>
                </div>
            </div>
          </section>

        </div>
        
        {/* Footer info */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 text-[10px] text-zinc-400 text-center font-medium">
          Las preferencias se guardan automáticamente en este dispositivo.
        </div>
      </div>
    </div>
  );
};
