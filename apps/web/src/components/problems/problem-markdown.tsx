"use client"

import * as React from "react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { cn } from "@/lib/utils"

type ProblemMarkdownProps = {
  markdown: string
  className?: string
}

export type MarkdownHeading = {
  id: string
  level: number
  text: string
}

type ProblemRichTextProps = {
  content?: string | null
  className?: string
  mode?: "auto" | "markdown" | "plain"
}

const MARKDOWN_PATTERN =
  /(^|\n)(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|```|`[^`]+`|\[[^\]]+\]\([^)]+\)|\|.+\||\*\*[^*]+\*\*|\$[^$\n]+\$|\\\(|\\\[|^\$\$/m
const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/

function looksLikeMarkdown(text: string) {
  return MARKDOWN_PATTERN.test(text)
}

function normalizeHeadingText(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .trim()
}

function slugifyHeading(text: string) {
  const normalized = normalizeHeadingText(text)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
  return normalized || "section"
}

function createUniqueHeadingId(baseId: string, counts: Map<string, number>) {
  const current = counts.get(baseId) ?? 0
  counts.set(baseId, current + 1)
  return current === 0 ? baseId : `${baseId}-${current + 1}`
}

function flattenMarkdownChildren(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(flattenMarkdownChildren).join("")
  if (React.isValidElement(node)) {
    return flattenMarkdownChildren((node.props as { children?: React.ReactNode }).children)
  }
  return ""
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const counts = new Map<string, number>()
  let insideFence = false

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith("```")) {
      insideFence = !insideFence
      continue
    }
    if (insideFence) continue

    const match = line.match(HEADING_PATTERN)
    if (!match) continue

    const level = match[1].length
    const text = normalizeHeadingText(match[2])
    if (!text) continue

    const id = createUniqueHeadingId(slugifyHeading(text), counts)
    headings.push({ id, level, text })
  }

  return headings
}

function createHeadingRenderer(
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
  counts: Map<string, number>
) {
  return ({
    node: _node,
    children,
    className,
    ...props
  }: {
    node?: unknown
    children?: React.ReactNode
    className?: string
  } & React.HTMLAttributes<HTMLHeadingElement>) => {
    const text = normalizeHeadingText(flattenMarkdownChildren(children))
    const id = createUniqueHeadingId(slugifyHeading(text), counts)

    return React.createElement(
      tag,
      {
        ...props,
        id,
        className: cn("group scroll-mt-20", className),
      },
      <span>{children}</span>,
      <a
        href={`#${id}`}
        aria-label={`跳转到 ${text}`}
        className="ml-2 text-muted-foreground no-underline opacity-0 transition-opacity hover:text-sky-700 group-hover:opacity-100"
      >
        #
      </a>
    )
  }
}

export function ProblemMarkdown({ markdown, className }: ProblemMarkdownProps) {
  const headingCounts = new Map<string, number>()

  return (
    <div
      className={cn(
        "prose max-w-none prose-headings:scroll-mt-20 prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-a:text-sky-700 prose-code:text-emerald-700 prose-pre:border prose-pre:border-border prose-pre:bg-muted prose-blockquote:border-border prose-blockquote:text-muted-foreground prose-hr:border-border prose-li:text-foreground prose-th:text-foreground prose-td:text-foreground",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ href, children, ...props }) => {
            if (!href) {
              return <span {...props}>{children}</span>
            }
            const isExternal = /^https?:\/\//i.test(href)
            if (isExternal) {
              return (
                <a href={href} target="_blank" rel="noreferrer" {...props}>
                  {children}
                </a>
              )
            }
            return (
              <Link href={href} {...props}>
                {children}
              </Link>
            )
          },
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className)
            if (isBlock) {
              return (
                <code className={cn("text-sm", className)} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] text-emerald-700"
                {...props}
              >
                {children}
              </code>
            )
          },
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          h1: createHeadingRenderer("h1", headingCounts),
          h2: createHeadingRenderer("h2", headingCounts),
          h3: createHeadingRenderer("h3", headingCounts),
          h4: createHeadingRenderer("h4", headingCounts),
          h5: createHeadingRenderer("h5", headingCounts),
          h6: createHeadingRenderer("h6", headingCounts),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

export function ProblemRichText({
  content,
  className,
  mode = "auto",
}: ProblemRichTextProps) {
  const value = content?.trim()
  if (!value) return null

  const renderMarkdown =
    mode === "markdown" || (mode === "auto" && looksLikeMarkdown(value))

  if (renderMarkdown) {
    return <ProblemMarkdown markdown={value} className={className} />
  }

  return (
    <div
      className={cn(
        "whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground",
        className
      )}
    >
      {value}
    </div>
  )
}
