import React, { useState, useEffect } from 'react';
import { Plus, Search, Menu } from 'lucide-react';
import { Note, Group, Theme } from './types';
import { AccordionItem } from './components/AccordionItem';
import { Sidebar } from './components/Sidebar';
import { SettingsWindow } from './components/SettingsWindow';
import { generateId } from './utils';

// Initial data for demonstration
const INITIAL_NOTES: Note[] = [
  {
    id: 'demo-1',
    title: 'Recursos IA (Ejemplo)',
    content: `Aquí tienes una lista de recursos importantes de IA.
  
https://gemini.google.com/app	v2 SETUP: AGENTES AI

https://notebooklm.google.com/	AI - OPENCLAW`,
    isOpen: true,
    createdAt: Date.now()
  }
];

const INITIAL_GROUPS: Group[] = [
  {
    id: 'g-1',
    title: 'General',
    notes: INITIAL_NOTES
  }
];

function App() {
  // --- STATE ---
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('accordion-notes-app-v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse groups', e);
      }
    }
    // Migration check: check for v1 data
    const oldV1Data = localStorage.getItem('accordion-notes-app');
    if (oldV1Data) {
      try {
        const oldNotes = JSON.parse(oldV1Data);
        return [{ id: generateId(), title: 'Migrado', notes: oldNotes }];
      } catch (e) {}
    }
    return INITIAL_GROUPS;
  });

  const [activeGroupId, setActiveGroupId] = useState<string | null>(groups[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<Theme>('dark'); // Default to dark as requested
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- EFFECTS ---

  // Persist Groups
  useEffect(() => {
    localStorage.setItem('accordion-notes-app-v2', JSON.stringify(groups));
  }, [groups]);

  // Handle Theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // --- ACTIONS ---

  const addGroup = () => {
    const title = prompt('Nombre del nuevo grupo (ej. "Trabajo", "Ideas"):');
    if (!title) return;

    const newGroup: Group = {
      id: generateId(),
      title: title.slice(0, 15), // Limit length for vertical display
      notes: []
    };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newGroup.id);
  };

  const updateGroupTitle = (groupId: string, newTitle: string) => {
      setGroups(groups.map(g => g.id === groupId ? { ...g, title: newTitle } : g));
  }

  const deleteGroup = (groupId: string) => {
      if(groups.length <= 1) {
          alert("Debes mantener al menos un grupo.");
          return;
      }
      if(confirm("¿Estás seguro? Todas las notas de este grupo se perderán.")) {
          const remaining = groups.filter(g => g.id !== groupId);
          setGroups(remaining);
          if (activeGroupId === groupId) {
              setActiveGroupId(remaining[0].id);
          }
      }
  }

  const addNote = () => {
    if (!activeGroupId) return;

    const newNote: Note = {
      id: generateId(),
      title: 'Nueva Nota',
      content: '',
      isOpen: true,
      createdAt: Date.now(),
    };

    setGroups(groups.map(g => {
      if (g.id === activeGroupId) {
        return { ...g, notes: [newNote, ...g.notes] };
      }
      return g;
    }));
  };

  // Fixed deleteNote function using functional state update
  const deleteNote = (noteId: string) => {
    // 1. Debugging: Verificamos en consola que llega la orden
    console.log("Borrando nota con ID:", noteId); 

    // 2. Usamos 'currentGroups' para asegurarnos de tener la data más fresca
    setGroups(currentGroups => currentGroups.map(g => {
      // Buscamos la nota en CADA grupo y la filtramos
      // Esto es más seguro que depender de activeGroupId o del closure antiguo
      return {
        ...g,
        notes: g.notes.filter(n => n.id !== noteId)
      };
    }));
  };

  const updateNote = (noteId: string, updates: Partial<Note>) => {
    // Also updated to use functional state for better reliability
    setGroups(currentGroups => currentGroups.map(g => {
        return {
          ...g,
          notes: g.notes.map(n => n.id === noteId ? { ...n, ...updates } : n)
        };
    }));
  };

  const toggleNote = (noteId: string) => {
     setGroups(currentGroups => currentGroups.map(g => {
        return {
          ...g,
          notes: g.notes.map(n => n.id === noteId ? { ...n, isOpen: !n.isOpen } : n)
        };
    }));
  };

  // --- RENDER ---

  const activeGroup = groups.find(g => g.id === activeGroupId);
  
  const filteredNotes = activeGroup 
    ? activeGroup.notes.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      
      {/* Sidebar */}
      <Sidebar 
        groups={groups}
        activeGroupId={activeGroupId}
        onSelectGroup={setActiveGroupId}
        onAddGroup={addGroup}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Group Title */}
              <div>
                  <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    {activeGroup ? (
                        <span 
                            className="cursor-pointer hover:underline decoration-dashed decoration-slate-400"
                            onClick={() => {
                                const newName = prompt("Renombrar grupo:", activeGroup.title);
                                if(newName) updateGroupTitle(activeGroup.id, newName);
                            }}
                        >
                            {activeGroup.title}
                        </span>
                    ) : 'Selecciona un Grupo'}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                     {activeGroup?.notes.length || 0} Notas
                  </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
                {activeGroup && (
                    <button 
                        onClick={() => deleteGroup(activeGroup.id)}
                        className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 text-xs mr-2"
                        title="Eliminar este grupo"
                    >
                        Eliminar Grupo
                    </button>
                )}
                <button
                    onClick={addNote}
                    disabled={!activeGroup}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus size={18} />
                    <span className="hidden sm:inline">Agregar Nota</span>
                </button>
            </div>
          </div>
        </div>

        {/* Scrollable Note Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto pb-20">
                {activeGroup ? (
                    <>
                         {/* Search Bar */}
                        <div className="mb-8 relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder={`Buscar en ${activeGroup.title}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                        />
                        </div>

                        {/* Notes */}
                        <div className="space-y-4">
                        {filteredNotes.length === 0 ? (
                            <div className="text-center py-20 opacity-60">
                            <div className="inline-block p-4 rounded-full bg-slate-200 dark:bg-slate-800 mb-4">
                                <Search size={32} className="text-slate-500 dark:text-slate-400" />
                            </div>
                            <p className="text-lg text-slate-600 dark:text-slate-400">No se encontraron notas.</p>
                            </div>
                        ) : (
                            filteredNotes.map(note => (
                            <AccordionItem
                                key={note.id}
                                note={note}
                                onToggle={() => toggleNote(note.id)}
                                onUpdate={(id, updates) => updateNote(id, updates)}
                                onDelete={deleteNote}
                            />
                            ))
                        )}
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <p>Selecciona o crea un grupo desde la barra lateral.</p>
                    </div>
                )}
            </div>
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsWindow 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />
    </div>
  );
}

export default App;