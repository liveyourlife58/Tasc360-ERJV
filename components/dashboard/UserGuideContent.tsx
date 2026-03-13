"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";

export function UserGuideContent({ content }: { content: string }) {
  return (
    <article className="user-guide-content">
      <ReactMarkdown
        rehypePlugins={[rehypeSlug]}
        components={{
          a: ({ href, children, ...props }) => {
            if (href?.startsWith("#")) {
              return (
                <a href={href} {...props}>
                  {children}
                </a>
              );
            }
            if (href?.startsWith("/dashboard")) {
              return (
                <Link href={href} {...props}>
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
          h1: ({ children, ...props }) => (
            <h1 className="user-guide-h1" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, id, ...props }) => (
            <h2 id={id ?? undefined} className="user-guide-h2" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, id, ...props }) => (
            <h3 id={id ?? undefined} className="user-guide-h3" {...props}>
              {children}
            </h3>
          ),
          ul: ({ children, ...props }) => (
            <ul className="user-guide-ul" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="user-guide-ol" {...props}>
              {children}
            </ol>
          ),
          p: ({ children, ...props }) => (
            <p className="user-guide-p" {...props}>
              {children}
            </p>
          ),
          strong: ({ children, ...props }) => (
            <strong className="user-guide-strong" {...props}>
              {children}
            </strong>
          ),
          hr: () => <hr className="user-guide-hr" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
