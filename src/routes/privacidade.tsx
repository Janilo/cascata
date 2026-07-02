import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Cascata" },
      {
        name: "description",
        content:
          "Como a Cascata coleta, usa e protege seus dados pessoais, em conformidade com a LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — Cascata" },
      { property: "og:image", content: "https://cascata.pereirasaraiva.com/og-social.png" },
      { property: "og:url", content: "https://cascata.pereirasaraiva.com/privacidade" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://cascata.pereirasaraiva.com/privacidade" }],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
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
          <h1 className="font-display text-4xl text-primary mt-3">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground mt-2">Última atualização: maio de 2026</p>

          <div className="mt-12 space-y-10 text-sm leading-relaxed text-foreground/80">
            <section>
              <h2 className="mb-3 font-semibold text-foreground">1. Quem somos</h2>
              <p>
                A Cascata é um produto de J P Saraiva Consultoria Ltda. ("nós"), com sede no Brasil.
                Somos o controlador dos dados pessoais coletados nesta plataforma.
              </p>
              <p className="mt-2">
                Contato:{" "}
                <a
                  href="mailto:privacidade@pereirasaraiva.com"
                  className="text-primary underline underline-offset-2"
                >
                  privacidade@pereirasaraiva.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">2. Dados coletados</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Conta:</strong> nome e e-mail no cadastro.
                </li>
                <li>
                  <strong>Negócio:</strong> dados financeiros de clientes (receita, descontos,
                  custos) enviados pelos usuários para compor o price waterfall.
                </li>
                <li>
                  <strong>Uso:</strong> logs de acesso, tipo de dispositivo e eventos de interação
                  com a plataforma.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">3. Finalidade e base legal</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>Prestação do serviço contratado (execução de contrato — art. 7º, V, LGPD).</li>
                <li>
                  Comunicações transacionais, como confirmação de conta (legítimo interesse — art.
                  7º, IX, LGPD).
                </li>
                <li>
                  Melhoria da plataforma com base em dados agregados e anonimizados (legítimo
                  interesse).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">4. Compartilhamento</h2>
              <p>
                Não vendemos dados pessoais. Compartilhamos apenas com subprocessadores necessários
                à operação (infraestrutura de nuvem, IA para extração de campos), sempre sob
                contrato com cláusulas de proteção de dados adequadas.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">5. Retenção</h2>
              <p>
                Mantemos os dados pelo prazo necessário à prestação do serviço. Após o encerramento
                da conta, os dados são excluídos em até 90 dias, salvo obrigação legal de retenção.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-semibold text-foreground">6. Seus direitos (LGPD)</h2>
              <p>
                Você pode solicitar confirmação de existência, acesso, correção, anonimização,
                portabilidade, exclusão e revogação do consentimento. Envie solicitações para{" "}
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
              <h2 className="mb-3 font-semibold text-foreground">7. Alterações</h2>
              <p>
                Atualizações relevantes serão comunicadas por e-mail ou banner na plataforma com
                antecedência mínima de 15 dias.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className="border-t border-border text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-6 md:px-10 py-5 flex items-center justify-between">
          <span>Cascata · 2026</span>
          <Link
            to="/termos"
            className="hover:text-foreground uppercase tracking-[0.18em] transition-colors"
          >
            Termos de Uso
          </Link>
        </div>
      </footer>
    </div>
  );
}
