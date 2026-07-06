"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type Props = {
    content: string;
    className?: string;
};

const markdownComponents: Components = {
    h1: ({ children }) => (
        <h1 className="mb-4 mt-2 text-2xl font-bold tracking-tight text-foreground first:mt-0">
            {children}
        </h1>
    ),
    h2: ({ children }) => (
        <h2 className="mb-3 mt-8 border-b border-border pb-2 text-xl font-semibold tracking-tight text-foreground first:mt-0">
            {children}
        </h2>
    ),
    h3: ({ children }) => (
        <h3 className="mb-2 mt-6 text-lg font-semibold text-foreground first:mt-0">{children}</h3>
    ),
    p: ({ children }) => (
        <p className="mb-4 leading-7 text-foreground/90 last:mb-0">{children}</p>
    ),
    ul: ({ children }) => (
        <ul className="mb-4 list-disc space-y-2 pl-6 text-foreground/90 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="mb-4 list-decimal space-y-2 pl-6 text-foreground/90 last:mb-0">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-7">{children}</li>,
    blockquote: ({ children }) => (
        <blockquote className="my-4 border-l-4 border-primary/30 bg-muted/40 py-2 pl-4 pr-2 italic text-muted-foreground">
            {children}
        </blockquote>
    ),
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
    hr: () => <hr className="my-8 border-border" />,
    a: ({ children, href }) => (
        <a
            href={href}
            className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            target="_blank"
            rel="noopener noreferrer"
        >
            {children}
        </a>
    ),
};

export function MarkdownContent({ content, className }: Props) {
    if (!content.trim()) {
        return <p className="text-sm italic text-muted-foreground">Nothing to preview yet.</p>;
    }

    return (
        <div className={cn("blog-content text-sm", className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
