import type { ReactNode } from "react";

export function ChartBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ?? "h-72 w-full min-w-0"}>{children}</div>;
}

type Row = { name?: string; value?: number; color?: string };

export function Tip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: Row[];
  label?: string | number;
  format?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-line bg-paper px-3 py-2 text-xs text-ink">
      {label != null && label !== "" ? <div className="mb-1 text-muted">{label}</div> : null}
      {payload.map((row) => (
        <div key={String(row.name)} className="flex justify-between gap-4 tabular-nums">
          <span>{row.name}</span>
          <span>
            {format && typeof row.value === "number"
              ? format(row.value, row.name ?? "")
              : row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export const tick = { fill: "var(--color-muted)", fontSize: 12 };
export const axisLine = { stroke: "var(--color-line)" };
