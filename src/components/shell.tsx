import type { ReactNode } from "react";

export const AUTHOR = "Tanmay Vaswani";

/** Set to the public repository once it exists; an empty string hides the link. */
export const SOURCE_URL = "https://github.com/TanmayVasvani/nse-factor-book";

export function Shell({ children, project }: { children: ReactNode; project: string }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="safe-top sticky z-20 border-b border-line bg-paper">
        <div className="gutter mx-auto flex max-w-6xl items-center justify-between gap-4 py-3">
          <p className="truncate font-display text-xl leading-none md:text-2xl">{project}</p>
          <div className="flex shrink-0 items-center gap-4 text-sm text-muted">
            <span className="hidden sm:inline">Applied finance portfolio</span>
            {SOURCE_URL ? (
              <a
                href={SOURCE_URL}
                className="min-h-11 py-2 text-ink underline decoration-line underline-offset-4 hover:decoration-teal"
              >
                Source
              </a>
            ) : null}
          </div>
        </div>
      </header>
      <main className="gutter mx-auto max-w-6xl py-8 md:py-12">{children}</main>
      <footer className="gutter mx-auto max-w-6xl border-t border-line py-8 text-sm leading-relaxed text-muted">
        <p>
          {AUTHOR} · 2026. Synthetic data, seeded and computed in the browser. Not a solicitation
          and not a forecast.
        </p>
      </footer>
    </div>
  );
}
