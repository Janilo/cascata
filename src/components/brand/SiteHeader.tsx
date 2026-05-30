import { Link } from "@tanstack/react-router";
import { CascataWordmark } from "@/components/brand/CascataWordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto max-w-6xl px-6 md:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label="Cascata — início">
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
            className="hidden sm:inline text-foreground hover:text-primary uppercase tracking-[0.18em] text-xs font-semibold"
          >
            Metodologia
          </Link>
          <Link
            to="/login"
            className="text-foreground hover:text-primary uppercase tracking-[0.18em] text-xs font-semibold"
          >
            Entrar
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 uppercase tracking-[0.18em] text-xs font-semibold hover:bg-[var(--purple-deep)] transition-colors"
          >
            Criar conta <span aria-hidden>→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
