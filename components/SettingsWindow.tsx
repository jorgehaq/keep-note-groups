import React from 'react';
import { X, Moon, Sun, Monitor, Type, CalendarClock, Palette, TextSelect, Languages } from 'lucide-react';
import { Theme, NoteFont } from '../types';
import { useTranslation } from 'react-i18next';

interface SettingsWindowProps {
  isOpen: boolean; 
  onClose: () => void;
  theme: Theme; 
  onThemeChange: (theme: Theme) => void;
  noteFont: NoteFont; 
  onNoteFontChange: (font: NoteFont) => void;
  noteFontSize: string; 
  onNoteFontSizeChange: (size: string) => void;
  dateFormat: string; 
  onDateFormatChange: (f: string) => void;
  timeFormat: string; 
  onTimeFormatChange: (f: string) => void;
}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({
  isOpen, onClose, theme, onThemeChange, noteFont, onNoteFontChange, noteFontSize, onNoteFontSizeChange, dateFormat, onDateFormatChange, timeFormat, onTimeFormatChange
}) => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('app-language', lng);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden max-h-[90vh] overflow-y-auto hidden-scrollbar">
        
        {/* HEADER */}
        <div className="sticky top-0 px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md z-10">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
            {t('settings.title')}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* SECCIÓN: IDIOMA */}
          <section className="p-5 bg-zinc-50 dark:bg-zinc-800/30 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Languages size={14}/> {t('settings.language')}
            </label>
            <div className="flex bg-zinc-200/50 dark:bg-zinc-900/50 rounded-xl p-1">
              <button 
                onClick={() => changeLanguage('es')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${i18n.language?.startsWith('es') ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Español
              </button>
              <button 
                onClick={() => changeLanguage('en')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${i18n.language?.startsWith('en') ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                English
              </button>
            </div>
          </section>
          
          {/* SECCIÓN: TEMA VISUAL */}
          <section className="p-5 bg-zinc-50 dark:bg-zinc-800/30 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Palette size={14}/> {t('settings.appearance')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'light', icon: Sun, label: t('settings.light') }, 
                { id: 'dark', icon: Moon, label: t('settings.dark') }, 
                { id: 'system', icon: Monitor, label: t('settings.system') }
              ].map(({ id, icon: Icon, label }) => (
                <button 
                  key={id} 
                  onClick={() => onThemeChange(id as Theme)} 
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${theme === id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'border-transparent bg-white dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 shadow-sm'}`}
                >
                  <Icon size={18} />
                  <span className="text-[11px] font-bold">{label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* SECCIÓN: TIPOGRAFÍA Y TAMAÑO */}
          <section className="p-5 bg-zinc-50 dark:bg-zinc-800/30 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Type size={14}/> {t('settings.typography')}
            </label>
            
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-2">{t('settings.font_style')}</p>
                <div className="flex bg-zinc-200/50 dark:bg-zinc-900/50 rounded-xl p-1">
                  {[
                    { id: 'sans', label: t('settings.modern') }, 
                    { id: 'serif', label: t('settings.classic') }, 
                    { id: 'mono', label: t('settings.code') }
                  ].map((font) => (
                    <button 
                      key={font.id} 
                      onClick={() => onNoteFontChange(font.id as NoteFont)} 
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${noteFont === font.id ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                      style={{ fontFamily: font.id === 'serif' ? 'serif' : font.id === 'mono' ? 'monospace' : 'sans-serif' }}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-1">
                  <TextSelect size={12}/> {t('settings.font_size')}
                </p>
                <div className="flex bg-zinc-200/50 dark:bg-zinc-900/50 rounded-xl p-1">
                  {[
                    { id: 'small', label: t('settings.small'), sizeClass: 'text-sm' }, 
                    { id: 'medium', label: t('settings.medium'), sizeClass: 'text-base' }, 
                    { id: 'large', label: t('settings.large'), sizeClass: 'text-lg' }
                  ].map((size) => (
                    <button 
                      key={size.id} 
                      onClick={() => onNoteFontSizeChange(size.id)} 
                      className={`flex-1 py-2 font-bold rounded-lg transition-all ${size.sizeClass} ${noteFontSize === size.id ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SECCIÓN: FORMATOS REGIONALES */}
          <section className="p-5 bg-zinc-50 dark:bg-zinc-800/30 rounded-3xl border border-zinc-100 dark:border-zinc-800">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <CalendarClock size={14}/> {t('settings.regional')}
            </label>
            
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-2">{t('settings.date_format')}</p>
                <div className="flex bg-zinc-200/50 dark:bg-zinc-900/50 rounded-xl p-1">
                  <button onClick={() => onDateFormatChange('dd/mm/yyyy')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${dateFormat === 'dd/mm/yyyy' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>{t('settings.day_month_year')}</button>
                  <button onClick={() => onDateFormatChange('mm/dd/yyyy')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${dateFormat === 'mm/dd/yyyy' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>{t('settings.month_day_year')}</button>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-2">{t('settings.time_format')}</p>
                <div className="flex bg-zinc-200/50 dark:bg-zinc-900/50 rounded-xl p-1">
                  <button onClick={() => onTimeFormatChange('12h')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${timeFormat === '12h' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>12h (AM/PM)</button>
                  <button onClick={() => onTimeFormatChange('24h')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${timeFormat === '24h' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>{t('settings.military')}</button>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};