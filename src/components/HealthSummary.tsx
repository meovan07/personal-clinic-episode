import ReactMarkdown, { type Components } from "react-markdown";

// The AI writes real Markdown (see summarize.ts): "## " section headers, "- " bullet
// lists, and "**bold**" reserved for the few facts that matter (abnormal values, drug
// names, upcoming dates) - rendered here as a highlighter mark, not just bold weight,
// so the important bits actually pop out of a long summary on a small screen.
const components: Components = {
  h2: ({ children }) => <h3 className="mt-4 text-sm font-semibold text-pine first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="mt-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-ink-faint">{children}</ul>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <mark className="rounded-sm bg-flag-low-tint px-1 font-semibold text-ink">{children}</mark>,
};

export function HealthSummary({ content }: { content: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
