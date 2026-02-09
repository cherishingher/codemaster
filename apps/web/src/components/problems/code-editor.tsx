"use client"

import * as React from "react"
import Editor from "@monaco-editor/react"

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  language?: string;
}

export function CodeEditor({ value, onChange, language = "typescript" }: CodeEditorProps) {
  // Simple dark mode detection or fixed dark mode since the app is dark themed
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: "on" as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    padding: { top: 16, bottom: 16 },
    // Hide editor validation squiggles (they're noisy without a real C++/Python LSP).
    renderValidationDecorations: "off" as const,
  };

  return (
    <div className="h-full w-full overflow-hidden rounded-md border bg-zinc-950">
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        theme="vs-dark"
        value={value}
        onChange={onChange}
        options={editorOptions}
      />
    </div>
  )
}
