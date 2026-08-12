// Minimal markdown renderer for LLM-generated section text: headings (###),
// bold (**text**), bullet lists (- / *), horizontal rules (---), and bare
// URLs. Not a full markdown parser — just enough to make generated summaries
// readable without pulling in a markdown library.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1]) {
      parts.push(<strong key={`${keyPrefix}-b-${i}`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <a
          key={`${keyPrefix}-a-${i}`}
          href={match[3]}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-border hover:text-foreground break-all"
        >
          {match[3]}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
    i++;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1.5 my-3 marker:text-muted-foreground/50">
        {listBuffer.map((item, i) => (
          <li key={i} className="text-base text-muted-foreground leading-relaxed">
            {renderInline(item, `li-${key}-${i}`)}
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      flushList();
      blocks.push(<hr key={`hr-${key++}`} className="border-border my-4" />);
      continue;
    }
    const heading = /^#{2,4}\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      blocks.push(
        <h4
          key={`h-${key++}`}
          className="text-lg text-foreground mt-4 mb-1.5 first:mt-0"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {heading[1]}
        </h4>
      );
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      listBuffer.push(bullet[1]);
      continue;
    }
    flushList();
    blocks.push(
      <p key={`p-${key++}`} className="text-base text-muted-foreground leading-relaxed mb-3 last:mb-0">
        {renderInline(line, `p-${key}`)}
      </p>
    );
  }
  flushList();

  return <>{blocks}</>;
}
