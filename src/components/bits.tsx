import { useId, type ReactNode } from "react";

export function StudyHeader({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: string;
  lede: string;
}) {
  return (
    <header className="max-w-3xl">
      <p className="text-xs tracking-widest text-teal uppercase">{kicker}</p>
      <h1 className="mt-2 text-4xl leading-tight md:text-5xl">{title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">{lede}</p>
    </header>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ink" | "teal" | "rust";
}) {
  const color = tone === "rust" ? "text-rust" : tone === "teal" ? "text-teal" : "text-ink";
  return (
    <div className="border-t border-line pt-3">
      <div className="text-xs tracking-widest text-muted uppercase">{label}</div>
      <div className={`mt-2 font-display text-3xl tabular-nums leading-none md:text-4xl ${color}`}>
        {value}
      </div>
      {hint ? <p className="mt-2 text-sm leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export function Field({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="block border-t border-line py-3">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink">{label}</span>
        <span className="text-sm tabular-nums text-teal">{display}</span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="border-t border-line py-3">
      <div className="mb-2 text-sm text-ink">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const on = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(opt.value)}
              className={
                on
                  ? "min-h-11 bg-ink px-3 text-sm text-paper"
                  : "min-h-11 border border-line px-3 text-sm text-muted"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Reset({ onClick, label = "Reset case" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 border border-line px-3 text-sm text-ink"
    >
      {label}
    </button>
  );
}

export function Reading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="border border-line bg-paper-2 px-4 py-4 md:px-5">
      <h2 className="text-2xl leading-tight">{title}</h2>
      <div className="mt-2 max-w-3xl text-sm leading-relaxed text-ink md:text-base">{children}</div>
    </aside>
  );
}

export function Method({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-t border-line py-4">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm text-ink">
        {title}
        <span className="text-muted group-open:hidden">Open</span>
        <span className="hidden text-muted group-open:inline">Close</span>
      </summary>
      <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );
}

export function Key({ items }: { items: { className: string; label: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span className={`inline-block size-3 ${item.className}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-2xl leading-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
