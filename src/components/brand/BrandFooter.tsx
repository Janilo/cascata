import { Link } from "@tanstack/react-router";

const RESPONDENTS_HREF = "https://pereirasaraiva.com/respondentes";

export function BrandFooter() {
  return (
    <footer className="mt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-row flex-nowrap items-center justify-between gap-3 border-t border-border/70 py-6">
          <p className="min-w-0 flex-1 truncate text-[11px] font-light text-muted-foreground sm:text-sm">
            Quer participar como respondente de pesquisas?
          </p>
          <a
            href={RESPONDENTS_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] text-foreground transition-opacity hover:opacity-70 sm:text-xs"
          >
            Cadastre-se aqui&nbsp;→
          </a>
        </div>
        <div className="flex flex-row flex-wrap items-center gap-x-6 gap-y-1 border-t border-border/70 py-5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
          <span className="font-semibold">Outros produtos</span>
          <a
            href="https://prisma.pereirasaraiva.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity hover:opacity-70"
          >
            Prisma · Marketing Mix Modeling
          </a>
          <a
            href="https://lente.pereirasaraiva.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-opacity hover:opacity-70"
          >
            Lente · Pesquisa Qualitativa
          </a>
        </div>
        <div className="flex flex-row flex-nowrap items-center justify-between gap-3 border-t border-border/70 py-6">
          <a
            href="https://pereirasaraiva.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-muted-foreground transition-opacity hover:opacity-70 sm:text-xs sm:tracking-[0.32em]"
          >
            J P Saraiva
          </a>
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
            <Link to="/privacidade" className="transition-opacity hover:opacity-70">
              Privacidade
            </Link>
            <Link to="/termos" className="transition-opacity hover:opacity-70">
              Termos
            </Link>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
