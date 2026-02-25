import React from 'react';
import { parseContentWithLinks } from '../utils';
import { ExternalLink } from 'lucide-react';

interface LinkifiedTextProps {
  content: string;
  searchQuery?: string;
}

const highlightSegment = (text: string, highlight?: string): React.ReactNode => {
  if (!highlight || !highlight.trim()) return text;
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === highlight.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/40 text-yellow-900 dark:text-yellow-100 rounded-sm px-0.5 font-medium">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ content, searchQuery }) => {
  if (!content) {
    return <span className="text-gray-400 italic">Empty note. Click edit to add content.</span>;
  }

  return (
    <div className="whitespace-pre-wrap break-words overflow-hidden font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {content.split('\n').map((line, lineIndex, arr) => {
        // Detectar regla horizontal exacta
        if (line.trim() === '---') {
          return <hr key={lineIndex} className="my-6 border-t border-zinc-200 dark:border-zinc-700/60 w-full" />;
        }

        const segments = parseContentWithLinks(line);
        return (
          <React.Fragment key={lineIndex}>
            {segments.map((segment) => {
              if (segment.type === 'link') {
                return (
                  <a
                    key={segment.key}
                    href={segment.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline break-all text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium bg-blue-50 dark:bg-blue-900/30 px-1 rounded transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {segment.content}
                    <ExternalLink size={12} className="inline-block ml-1 align-text-bottom" />
                  </a>
                );
              }
              return <span key={segment.key}>{highlightSegment(segment.content, searchQuery)}</span>;
            })}
            {/* Respetar los saltos de línea originales excepto en la última línea */}
            {lineIndex < arr.length - 1 && '\n'}
          </React.Fragment>
        );
      })}
    </div>
  );
};
