import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { sanitizeNestedCodeBlocks } from '../utils/markdownParser';

interface NoteEditorProps {
  content: string;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ content }) => {
  // Memoización para evitar re-sanitización innecesaria en cada render
  const safeContent = useMemo(() => sanitizeNestedCodeBlocks(content), [content]);

  return (
    <div className="prose max-w-none dark:prose-invert">
      <ReactMarkdown>
        {safeContent}
      </ReactMarkdown>
    </div>
  );
};
