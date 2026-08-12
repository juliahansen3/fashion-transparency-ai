import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, ArrowRight, Sparkles, X, ArrowLeft, GitCompare, Loader2 } from "lucide-react";
import {
  fetchSummary,
  fetchComparison,
  parseSummary,
  parseComparison,
  type ParsedSummary,
  type ParsedComparison,
} from "./lib/api";
import { MarkdownLite } from "./lib/markdown";

const BRANDS = [
  "Forever 21", "Gap", "H&M", "Mango", "Patagonia",
  "Primark", "Shein", "Uniqlo", "Urban Outfitters", "Zara",
];

const PILLARS = [
  { label: "Labor Practices", description: "Worker wages, factory conditions, union rights, audit transparency" },
  { label: "Environmental Impact", description: "Carbon footprint, water usage, clothing material, circularity programs" },
  { label: "Supply Chain Transparency", description: "Tier-1/2/3 supplier disclosure, traceability, third-party certifications" },
];

const SUMMARY_SECTIONS = [
  { key: "overview",      title: "Brand Overview",              defaultOpen: true  },
  { key: "labor",         title: "Labor Practices",             defaultOpen: false },
  { key: "environment",   title: "Environmental Impact",        defaultOpen: false },
  { key: "transparency",  title: "Transparency & Accountability", defaultOpen: false },
  { key: "tradeoff",      title: "Overall Tradeoff Summary",    defaultOpen: false },
];

const COMPARISON_CATEGORIES = [
  { key: "labor",        title: "Labor Practices"              },
  { key: "environment",  title: "Environmental Impact"         },
  { key: "transparency", title: "Transparency & Accountability" },
];

// ─── Shared UI ────────────────────────────────────────────────────────────────

function CollapseArrow({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex items-center justify-center w-9 h-9 rounded-full border-2 shrink-0 transition-all duration-200 ${
        open
          ? "bg-accent border-accent text-accent-foreground rotate-180"
          : "border-border text-foreground hover:border-accent hover:text-accent"
      }`}
    >
      <ChevronDown size={20} strokeWidth={2.5} />
    </span>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-lg text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {title}
        </span>
        <CollapseArrow open={open} />
      </button>
      {open && <div className="pb-6">{children}</div>}
    </div>
  );
}

function Nav({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="border-b border-border shrink-0">
      <div className="max-w-5xl mx-auto px-8 h-14 flex items-center justify-between">
        {left}
        {right}
      </div>
    </header>
  );
}

function Footer({ width = "5xl" }: { width?: string }) {
  return (
    <footer className="border-t border-border shrink-0">
      <div className={`max-w-${width} mx-auto px-8 h-12 flex items-center justify-between`}>
        <span className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
          © 2026 Unravel · Not affiliated with any brand
        </span>
        <div className="flex items-center gap-6">
          {["Privacy", "Terms", "Contact"].map((item) => (
            <a key={item} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors" style={{ fontFamily: "'DM Mono', monospace" }}>
              {item}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Placeholder block ────────────────────────────────────────────────────────

function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-muted/30 px-4 py-3">
      <p className="text-sm text-muted-foreground leading-relaxed italic">{label}</p>
    </div>
  );
}

function Finding({ text }: { text: string }) {
  return (
    <div className="rounded-sm border border-border bg-card px-4 py-3">
      <p className="text-sm text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function LoadingNote({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-3" style={{ fontFamily: "'DM Mono', monospace" }}>
      <Loader2 size={13} className="animate-spin" />
      {label}
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-4 py-3">
      <p className="text-xs text-destructive leading-relaxed">{message}</p>
    </div>
  );
}

function CollapsibleCard({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border rounded-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 bg-secondary/30 border-b border-border text-left"
        aria-expanded={open}
      >
        <h2 className="text-lg text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {title}
        </h2>
        <CollapseArrow open={open} />
      </button>
      {open && children}
    </div>
  );
}

// ─── Comparison Page ──────────────────────────────────────────────────────────

function BrandPicker({
  value,
  onChange,
  exclude,
  placeholder,
}: {
  value: string | null;
  onChange: (brand: string | null) => void;
  exclude?: string | null;
  placeholder: string;
}) {
  const [query, setQuery] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pool = exclude ? BRANDS.filter((b) => b !== exclude) : BRANDS;
  const filtered = query.trim() ? pool.filter((b) => b.toLowerCase().includes(query.toLowerCase())) : pool;

  useEffect(() => { setHighlight(0); }, [query]);
  useEffect(() => { setQuery(value ?? ""); }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(brand: string) {
    setQuery(brand);
    onChange(brand);
    setOpen(false);
  }

  function clear() {
    setQuery("");
    onChange(null);
    inputRef.current?.focus();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`flex items-center border rounded-sm bg-card transition-all duration-150 cursor-text min-w-[200px] focus-within:ring-1 focus-within:ring-ring ${value ? "border-primary" : "border-border"}`}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open) { if (e.key === "ArrowDown" || e.key === "Enter") setOpen(true); return; }
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((i) => Math.min(i + 1, filtered.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { if (filtered[highlight]) select(filtered[highlight]); }
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 outline-none placeholder:text-muted-foreground/60 text-foreground"
          style={value ? { fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.875rem", lineHeight: 1.3 } : { fontSize: "0.875rem" }}
          autoComplete="off"
        />
        {value && (
          <button onClick={(e) => { e.stopPropagation(); clear(); }} className="pr-2 text-muted-foreground hover:text-foreground transition-colors">
            <X size={13} />
          </button>
        )}
        <ChevronDown size={13} strokeWidth={1.5} className={`mr-2.5 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-52 bg-card border border-border rounded-sm shadow-lg overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">No brands found.</p>
          ) : (
            <ul className="max-h-52 overflow-y-auto py-1" style={{ scrollbarWidth: "none" }}>
              {filtered.map((b, i) => (
                <li
                  key={b}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors duration-100 ${i === highlight ? "bg-secondary text-foreground" : "text-foreground hover:bg-secondary/60"}`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => { e.preventDefault(); select(b); }}
                >
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonPage({
  brandA: initialBrandA,
  onBack,
}: {
  brandA: string;
  onBack: () => void;
}) {
  const [brandA, setBrandA] = useState<string | null>(initialBrandA);
  const [brandB, setBrandB] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const [comparison, setComparison] = useState<ParsedComparison | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const ready = !!brandA && !!brandB;

  useEffect(() => {
    if (!brandA || !brandB) {
      setComparison(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setComparison(null);
    fetchComparison(brandA, brandB)
      .then((res) => {
        if (cancelled) return;
        setComparison(parseComparison(res.comparison));
        setStatus("idle");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load comparison.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [brandA, brandB]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Nav
        left={
          <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} strokeWidth={1.5} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.7rem", letterSpacing: "0.04em" }}>Unravel</span>
          </button>
        }
      />

      <main className="flex-1 max-w-5xl mx-auto px-8 w-full py-12">

        {/* Page heading */}
        <div className="mb-10 pb-8 border-b border-border">
          <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em" }}>
            BRAND COMPARISON
          </p>

          {/* Brand A + Brand B pickers */}
          <div className="flex items-center gap-4 flex-wrap">
            <BrandPicker
              value={brandA}
              onChange={setBrandA}
              exclude={brandB}
              placeholder="Select first brand…"
            />
            <span className="text-muted-foreground text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>vs.</span>
            <BrandPicker
              value={brandB}
              onChange={setBrandB}
              exclude={brandA}
              placeholder="Select second brand…"
            />
          </div>

          {!ready && (
            <p className="mt-4 text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
              {!brandA ? "Select a first brand to begin." : "Select a second brand to see the comparison."}
            </p>
          )}
        </div>

        {/* Comparison body */}
        {ready && (
          <div className="space-y-8">

            {status === "loading" && (
              <LoadingNote label={`Comparing ${brandA} and ${brandB}…`} />
            )}
            {status === "error" && error && <ErrorNote message={error} />}

            {comparison && (
              <>
                {/* Category cards */}
                {COMPARISON_CATEGORIES.map((cat) => {
                  const data = comparison.categories[cat.key];
                  const shared = [
                    ...(data?.sharedStrengths ?? []),
                    ...(data?.sharedWeaknesses ?? []),
                  ];
                  return (
                    <CollapsibleCard key={cat.key} title={cat.title}>
                      {/* Three-column body */}
                      <div className="grid grid-cols-[1fr_1px_1fr_1px_1fr]">
                        {/* Brand A */}
                        <div className="p-6 space-y-3">
                          <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.03em" }}>
                            {brandA!.toUpperCase()}
                          </p>
                          {data && data.brandA.length > 0 ? (
                            data.brandA.map((t, i) => <Finding key={i} text={t} />)
                          ) : (
                            <Placeholder label="Key findings for this brand will appear here based on available public disclosures and third-party audits." />
                          )}
                        </div>

                        {/* Divider */}
                        <div className="bg-border" />

                        {/* Shared */}
                        <div className="p-6 bg-muted/20 space-y-3">
                          <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.03em" }}>
                            SHARED
                          </p>
                          {shared.length > 0 ? (
                            shared.map((t, i) => <Finding key={i} text={t} />)
                          ) : (
                            <>
                              <Placeholder label="Shared strengths both brands demonstrate in this area." />
                              <Placeholder label="Shared weaknesses or gaps common to both brands." />
                            </>
                          )}
                        </div>

                        {/* Divider */}
                        <div className="bg-border" />

                        {/* Brand B */}
                        <div className="p-6 space-y-3">
                          <p className="text-xs text-muted-foreground mb-3" style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.03em" }}>
                            {brandB!.toUpperCase()}
                          </p>
                          {data && data.brandB.length > 0 ? (
                            data.brandB.map((t, i) => <Finding key={i} text={t} />)
                          ) : (
                            <Placeholder label="Key findings for this brand will appear here based on available public disclosures and third-party audits." />
                          )}
                        </div>
                      </div>
                    </CollapsibleCard>
                  );
                })}

                {/* Key Tradeoffs */}
                <div className="border-t border-border pt-8 space-y-6">
                  <div>
                    <h2
                      className="text-2xl text-foreground mb-4"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}
                    >
                      Key Tradeoffs
                    </h2>
                    <div className="space-y-3">
                      {comparison.keyTradeoffs.length > 0 ? (
                        comparison.keyTradeoffs.map((t, i) => <Finding key={i} text={t} />)
                      ) : (
                        <>
                          <Placeholder label="A key tradeoff consumers face when choosing between these two brands — e.g. price vs. labor standards." />
                          <Placeholder label="A second tradeoff, such as environmental certifications vs. production volume." />
                          <Placeholder label="A third tradeoff, such as transparency of reporting vs. actual supply chain conditions." />
                        </>
                      )}
                    </div>
                  </div>

                  {/* What This Means in Practice */}
                  <div>
                    <h2
                      className="text-2xl text-foreground mb-4"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}
                    >
                      What This Means in Practice
                    </h2>
                    <div className="border border-border rounded-sm p-6 space-y-4">
                      {(
                        [
                          ["If minimizing labor risk is your highest priority…", comparison.practiceGuidance.labor],
                          ["If environmental initiatives matter more…", comparison.practiceGuidance.environment],
                          ["If transparency is most important…", comparison.practiceGuidance.transparency],
                          ["Overall…", comparison.practiceGuidance.overall],
                        ] as [string, string][]
                      ).map(([prompt, guidance]) => (
                        <div key={prompt} className="flex items-start gap-3">
                          <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                          <div className="space-y-1.5 flex-1">
                            <p className="text-base text-foreground">{prompt}</p>
                            {guidance ? (
                              <p className="text-base text-muted-foreground leading-relaxed">{guidance}</p>
                            ) : (
                              <Placeholder label="Guidance will appear here." />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sources */}
                  <div className="border-t border-border pt-6">
                    <button
                      onClick={() => setSourcesOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-4 py-4 text-left"
                      aria-expanded={sourcesOpen}
                    >
                      <span className="text-lg text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Sources
                      </span>
                      <CollapseArrow open={sourcesOpen} />
                    </button>
                    {sourcesOpen && (
                      <div className="pb-6 space-y-3">
                        {comparison.sources.length > 0 ? (
                          comparison.sources.map((s, i) => <Finding key={i} text={s} />)
                        ) : (
                          <>
                            <Placeholder label="Source 1 — Publisher · Year" />
                            <Placeholder label="Source 2 — Publisher · Year" />
                            <Placeholder label="Source 3 — Publisher · Year" />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <Footer width="5xl" />
    </div>
  );
}

// ─── Brand Summary Page ───────────────────────────────────────────────────────

function BrandSummaryPage({
  brand,
  onBack,
  onCompare,
}: {
  brand: string;
  onBack: () => void;
  onCompare: () => void;
}) {
  const [parsed, setParsed] = useState<ParsedSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setParsed(null);
    fetchSummary(brand)
      .then((res) => {
        if (cancelled) return;
        setParsed(parseSummary(res.summary));
        setStatus("idle");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load summary.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [brand]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Nav
        left={
          <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} strokeWidth={1.5} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.7rem", letterSpacing: "0.04em" }}>Unravel</span>
          </button>
        }
        right={
          <button
            onClick={onCompare}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-xs rounded-sm hover:bg-accent transition-colors duration-150"
            style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.02em" }}
          >
            <GitCompare size={13} strokeWidth={1.5} />
            Compare with another brand
          </button>
        }
      />

      <main className="flex-1 max-w-4xl mx-auto px-8 w-full py-12">
        <div className="mb-10 pb-8 border-b border-border">
          <h1 className="text-4xl font-normal text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}>
            {brand}
          </h1>
        </div>

        {status === "loading" && <LoadingNote label={`Loading summary for ${brand}…`} />}
        {status === "error" && error && <ErrorNote message={error} />}

        <div>
          {SUMMARY_SECTIONS.map((section) => {
            const content = parsed?.sections[section.key];
            return (
              <CollapsibleSection key={section.key} title={section.title} defaultOpen={section.defaultOpen}>
                {content ? (
                  <MarkdownLite text={content} />
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Summary content for {section.title} will appear here.
                  </p>
                )}
              </CollapsibleSection>
            );
          })}
        </div>

        <div className="mt-10">
          <button
            onClick={onCompare}
            className="inline-flex items-center gap-2 border border-primary text-primary px-5 py-3 text-sm rounded-sm hover:bg-primary hover:text-primary-foreground transition-colors duration-150"
          >
            <GitCompare size={14} strokeWidth={1.5} />
            Compare with another brand
          </button>
        </div>
      </main>

      <Footer width="4xl" />
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<"home" | "summary" | "compare">("home");
  const [activeBrand, setActiveBrand] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? BRANDS.filter((b) => b.toLowerCase().includes(query.toLowerCase()))
    : BRANDS;

  const exactMatch = BRANDS.some((b) => b.toLowerCase() === query.trim().toLowerCase());
  const showNotFound = query.trim().length > 1 && filtered.length === 0;
  const showGenerate = query.trim().length > 1 && !exactMatch && !selected;

  useEffect(() => { setHighlightIndex(0); }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(brand: string) {
    setSelected(brand);
    setQuery(brand);
    setIsOpen(false);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex]); }
    else if (e.key === "Escape") setIsOpen(false);
  }

  function goToBrand(brand: string) {
    setActiveBrand(brand);
    setPage("summary");
  }

  function goToCompare() {
    setPage("compare");
  }

  function goHome() {
    setPage("home");
    setSelected(null);
    setQuery("");
  }

  const displayValue = selected && query === selected ? selected : query;

  if (page === "compare" && activeBrand) {
    return <ComparisonPage brandA={activeBrand} onBack={() => setPage("summary")} />;
  }

  if (page === "summary" && activeBrand) {
    return <BrandSummaryPage brand={activeBrand} onBack={goHome} onCompare={goToCompare} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center" aria-hidden>
              <div className="w-3 h-3 border border-primary-foreground rounded-[1px]" />
            </div>
            <span className="text-sm font-medium text-foreground" style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em" }}>
              Unravel
            </span>
          </div>
          
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="max-w-5xl mx-auto px-8 pt-24 pb-16 w-full">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-xs text-accent mb-8 border border-accent/30 px-3 py-1.5 rounded-sm" style={{ fontFamily: "'DM Mono', monospace" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              AI-POWERED RESEARCH TOOL
            </div>
            <h1 className="text-5xl font-normal text-foreground leading-[1.15] mb-5" style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400 }}>
              Understand every brand according to your values.
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
              Evidence-based summaries of labor practices, environmental impact, and supply chain transparency — so you can shop quickly with clarity.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-8 pb-16 w-full">
          <div className="max-w-xl mx-auto group/search">
            {/* Hover trigger */}
            <div className="w-fit mx-auto flex items-center gap-2 text-sm text-accent border border-accent/30 px-4 py-2.5 rounded-sm cursor-default" style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.02em" }}>
              <Search size={14} strokeWidth={1.5} />
              Start Searching
            </div>

            {/* Search (hidden until hovered/focused) */}
            <div className="max-h-0 opacity-0 overflow-hidden group-hover/search:max-h-[32rem] group-hover/search:overflow-visible group-hover/search:opacity-100 group-hover/search:mt-6 group-focus-within/search:max-h-[32rem] group-focus-within/search:overflow-visible group-focus-within/search:opacity-100 group-focus-within/search:mt-6 transition-all duration-300 ease-out">
              <label className="block text-xs mb-2 text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em" }} htmlFor="brand-search">
                SEARCH A BRAND
              </label>
              <div className="relative" ref={dropdownRef}>
                <div
                  className="flex items-center border border-border bg-card rounded-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all duration-150"
                  onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
                >
                  <Search className="ml-3.5 text-muted-foreground shrink-0" size={15} strokeWidth={1.5} />
                  <input
                    ref={inputRef}
                    id="brand-search"
                    type="text"
                    value={displayValue}
                    onChange={(e) => { setQuery(e.target.value); setSelected(null); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search by brand name…"
                    className="flex-1 bg-transparent px-3 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                  />
                  <div className="flex items-center pr-3 gap-1">
                    {(selected || query) && (
                      <button onClick={(e) => { e.stopPropagation(); handleClear(); }} className="p-1 text-muted-foreground hover:text-foreground transition-colors" aria-label="Clear selection">
                        <X size={13} />
                      </button>
                    )}
                    <ChevronDown size={14} strokeWidth={1.5} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {isOpen && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-sm shadow-lg overflow-hidden">
                    {showNotFound ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-sm text-muted-foreground mb-1">
                          No results for <span className="text-foreground font-medium">&ldquo;{query}&rdquo;</span>
                        </p>
                        <p className="text-xs text-muted-foreground/70 mb-4">This brand isn&apos;t in our database yet.</p>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); setIsOpen(false); goToBrand(query.trim()); }}
                          className="inline-flex items-center gap-2 border border-border text-foreground px-4 py-2.5 text-sm rounded-sm hover:bg-secondary transition-colors duration-150"
                        >
                          <Sparkles size={13} strokeWidth={1.5} className="text-accent" />
                          Generate Summary for &ldquo;{query}&rdquo;
                        </button>
                      </div>
                    ) : (
                      <ul role="listbox" className="max-h-60 overflow-y-auto py-1" style={{ scrollbarWidth: "none" }}>
                        {filtered.map((brand, i) => (
                          <li
                            key={brand}
                            role="option"
                            aria-selected={brand === selected}
                            className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors duration-100 ${i === highlightIndex ? "bg-secondary text-foreground" : "text-foreground hover:bg-secondary/60"}`}
                            onMouseEnter={() => setHighlightIndex(i)}
                            onMouseDown={(e) => { e.preventDefault(); handleSelect(brand); }}
                          >
                            {brand}
                            {brand === selected && (
                              <span className="text-xs text-accent" style={{ fontFamily: "'DM Mono', monospace" }}>selected</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  disabled={!selected}
                  onClick={() => selected && goToBrand(selected)}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 text-sm rounded-sm hover:bg-accent transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  View Brand Summary
                  <ArrowRight size={14} strokeWidth={2} />
                </button>
                {showGenerate && !isOpen && (
                  <button
                    onClick={() => goToBrand(query.trim())}
                    className="inline-flex items-center gap-2 border border-border text-foreground px-5 py-3 text-sm rounded-sm hover:bg-secondary transition-colors duration-150"
                  >
                    <Sparkles size={14} strokeWidth={1.5} className="text-accent" />
                    Generate Summary for &ldquo;{query}&rdquo;
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-8 w-full"><hr className="border-border" /></div>

        <section className="max-w-5xl mx-auto px-8 py-14 w-full">
          <p className="text-xs text-muted-foreground mb-8" style={{ fontFamily: "'DM Mono', monospace", letterSpacing: "0.04em" }}>WHAT WE MEASURE</p>
          <div className="grid grid-cols-3 gap-px bg-border rounded-sm overflow-hidden">
            {PILLARS.map(({ label, description }) => (
              <div key={label} className="bg-background p-6">
                <h3 className="text-sm font-medium text-foreground mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-8 pb-16 w-full">
          <div className="flex items-center gap-10 flex-wrap">
            {[{ value: "10+", label: "Brands indexed" }, { value: "Q2 2026", label: "Last data refresh" }, { value: "Open", label: "Methodology" }].map(({ value, label }) => (
              <div key={label} className="flex items-baseline gap-2">
                <span className="text-lg text-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{value}</span>
                <span className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{label}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
