import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import Editor from '@monaco-editor/react';

/**
 * Monaco Editor Component for Python Code
 *
 * This component wraps Monaco editor for inline Python code editing.
 * Requires @monaco-editor/react package to be installed.
 *
 * Installation:
 *   npm install @monaco-editor/react
 *
 * Props:
 * - value: Current code value
 * - onChange: Callback when code changes
 * - height: Editor height (default: 400px)
 * - readOnly: Whether editor is read-only
 * - language: Programming language (default: python)
 */
const CodeEditor = ({
  value = '',
  onChange,
  height = 400,
  readOnly = false,
  language = 'python'
}) => {
  const handleEditorChange = (newValue) => {
    onChange?.(newValue || '');
  };

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        '& .monaco-editor': {
          borderRadius: 1
        }
      }}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleEditorChange}
        theme="vs-dark"
        loading={
          <Box
            sx={{
              height,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#1e1e1e'
            }}
          >
            <CircularProgress />
          </Box>
        }
        options={{
          // Editor appearance
          fontSize: 14,
          lineHeight: 20,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
          fontLigatures: true,

          // Features
          minimap: { enabled: false },
          lineNumbers: 'on',
          rulers: [80, 120],
          wordWrap: 'on',
          wrappingIndent: 'indent',

          // Behavior
          readOnly: readOnly,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,

          // UI elements
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10
          },

          // Code intelligence
          suggest: {
            enabled: true,
            showWords: true,
            showSnippets: true
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false
          },
          parameterHints: { enabled: true },

          // Formatting
          formatOnPaste: true,
          formatOnType: false,

          // Bracket matching
          matchBrackets: 'always',
          bracketPairColorization: { enabled: true }
        }}
      />
    </Box>
  );
};

export default CodeEditor;
