"use client"

import * as React from "react"
import Editor from "@monaco-editor/react"

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
}

export function CodeEditor({ value, onChange, language = "typescript" }: CodeEditorProps) {
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 15,
    lineNumbers: "on" as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 16, bottom: 16 },
    // Hide editor validation squiggles (they're noisy without a real C++/Python LSP).
    renderValidationDecorations: "off" as const,
  };

  return (
    <div className="h-full w-full overflow-hidden rounded-[1.2rem] border-[3px] border-border bg-background shadow-[8px_8px_0_hsl(var(--border))]">
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        theme="vs"
        value={value}
        onChange={onChange}
        options={editorOptions}
      />
    </div>
  )
}
