import React from 'react';
import { parseContentWithLinks } from '../utils';
import { ExternalLink } from 'lucide-react';

interface LinkifiedTextProps {
  content: string;
}

export const LinkifiedText: React.FC<LinkifiedTextProps> = ({ content }) => {
  const segments = parseContentWithLinks(content);

  if (!content) {
    return <span className="text-gray-400 italic">Empty note. Click edit to add content.</span>;
  }

  return (
    <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {segments.map((segment) => {
        if (segment.type === 'link') {
          return (
            <a
              key={segment.key}
              href={segment.content}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium bg-blue-50 dark:bg-blue-900/30 px-1 rounded transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {segment.content}
              <ExternalLink size={12} />
            </a>
          );
        }
        return <span key={segment.key}>{segment.content}</span>;
      })}
    </div>
  );
};
