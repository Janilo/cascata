import { Link } from "@tanstack/react-router";
import { CascataWordmark } from "@/components/brand/CascataWordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
        <div className="inline-flex items-center gap-3">
          <Link to="/" aria-label="Cascata — início" className="inline-flex items-center hover:opacity-80 transition-opacity">
            <CascataWordmark height={28} />
          </Link>
          <a
            href="https://pereirasaraiva.com"
            target="_blank"
            rel="noopener noreferrer"
            className="eyebrow hidden sm:inline hover:opacity-70 transition-opacity"
          >
            por J P Saraiva
          </a>
        </div>
        <nav className="flex items-center gap-6 sm:gap-8">
          <Link
            to="/metodologia"
            className="hidden sm:inline text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground transition-opacity hover:opacity-70"
          >
            Metodologia
          </Link>
          <Link
            to="/login"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground transition-opacity hover:opacity-70"
          >
            Entrar
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] hover:bg-[var(--purple-deep)] transition-colors"
          >
            Criar conta <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
