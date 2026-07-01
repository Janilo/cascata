import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Cascata" },
      { name: "description", content: "Termos e condições de uso da plataforma Cascata." },
      { property: "og:title", content: "Termos de Uso — Cascata" },
      { property: "og:image", content: "/og-social.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://cascata.pereirasaraiva.com/termos" }],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-5">
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            ← Cascata
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-10 py-20">
          <p className="eyebrow">Legal</p>
          <h1 className="font-display text-4xl text-primary mt-3">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground mt-2">Última atualização: maio de 2026</p>

          <div className="mt-12 space-y-10 text-sm leading-relaxed text-foreground/80">
            <section>
              <h2 className="mb-3 font-semibold text-foreground">1. Aceitação</h2>
              <p>
                Ao criar uma conta ou usar a Cascata, você concorda com estes Termos. Se não
                concordar, não utilize a plataforma.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">2. Descrição do serviço</h2>
              <p>
                A Cascata é uma plataforma de price waterfall por cliente. Permite que departamentos
                subam dados financeiros (receita, descontos, custos), a IA lê os arquivos e o
                waterfall se monta com drill-down nas 33 sublinhas de desconto comercial.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">3. Uso aceitável</h2>
              <p>Você concorda em não:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Carregar dados financeiros de terceiros sem autorização.</li>
                <li>
                  Tentar acessar dados de outras organizações ou contornar mecanismos de segurança.
                </li>
                <li>Revender ou sublicenciar o acesso à plataforma sem autorização.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">4. Propriedade dos dados</h2>
              <p>
                Você retém a propriedade dos dados financeiros que submete. Ao usá-la, nos concede
                licença limitada para processar esses dados exclusivamente para a prestação do
                serviço.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">5. Confidencialidade</h2>
              <p>
                Tratamos os dados financeiros carregados como informação confidencial. Não os
                compartilhamos com terceiros além dos subprocessadores operacionais necessários.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">6. Disponibilidade</h2>
              <p>
                Buscamos disponibilidade contínua, mas não garantimos uptime de 100%. Não nos
                responsabilizamos por perdas decorrentes de indisponibilidade não programada.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">7. Encerramento</h2>
              <p>
                Podemos suspender contas que violem estes Termos. Você pode encerrar sua conta a
                qualquer momento enviando solicitação para{" "}
                <a
                  href="mailto:privacidade@pereirasaraiva.com"
                  className="text-primary underline underline-offset-2"
                >
                  privacidade@pereirasaraiva.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">8. Lei aplicável</h2>
              <p>
                Estes Termos são regidos pelas leis brasileiras. Eventuais conflitos serão
                resolvidos no foro da Comarca de São Paulo — SP.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className="border-t border-border text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-5 flex items-center justify-between">
          <span>Cascata · 2026</span>
          <Link
            to="/privacidade"
            className="hover:text-foreground uppercase tracking-[0.18em] transition-colors"
          >
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
