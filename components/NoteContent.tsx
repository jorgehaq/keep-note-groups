import React from 'react';

interface NoteContentProps {
  content: string;
}

/**
 * 1. Función utilitaria para romper la regla del parser.
 * Reemplaza triple backtick con backticks separados por Zero-width space.
 * El usuario verá "```" pero el parser no lo reconocerá.
 */
const neutralizeCodeBlocks = (text: string) => {
  if (!text) return '';
  return text.replace(/```/g, '`\u200B`\u200B`');
};

/**
 * NoteContent - Renders text with "Syntax Indifference".
 * Treats markdown symbols as plain characters using neutralization.
 */
export const NoteContent: React.FC<NoteContentProps> = ({ content }) => {
  const safeContent = neutralizeCodeBlocks(content);

  return (
    <div 
      className="raw-note-content font-mono text-sm bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800"
    >
      {safeContent}
    </div>
  );
};
