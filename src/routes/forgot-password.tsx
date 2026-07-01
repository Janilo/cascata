import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CascataWordmark } from "@/components/brand/CascataWordmark";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Esqueci a senha — Cascata" }, { name: "robots", content: "noindex" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-screen flex">
      <aside
        className="hidden md:flex w-1/2 bg-primary text-primary-foreground p-16 flex-col justify-between"
        aria-hidden="true"
      >
        <Link to="/" aria-label="Cascata" className="text-primary-foreground">
          <CascataWordmark height={28} className="!text-current" />
        </Link>
        <div>
          <p className="eyebrow !text-[var(--gold)] mb-6">PRICING · WATERFALL</p>
          <p className="font-display text-5xl italic leading-tight">
            Sem senha?
            <br />
            Sem problema.
          </p>
        </div>
        <a
          href="https://pereirasaraiva.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs uppercase tracking-[0.18em] opacity-60"
        >
          por J P Saraiva
        </a>
      </aside>

      <main className="flex-1 flex items-center justify-center p-12">
        <div className="w-full max-w-sm">
          <p className="eyebrow mb-6">RECUPERAR ACESSO</p>
          <h1 className="font-display text-4xl text-primary mb-4">Esqueci a senha.</h1>
          <p className="text-sm text-muted-foreground mb-10">
            Informe seu email e enviaremos um link para criar uma nova senha.
          </p>

          {sent ? (
            <div className="border border-foreground/20 p-4 text-sm text-foreground">
              Se existir uma conta com <strong>{email}</strong>, você receberá em instantes um link
              para redefinir sua senha. Verifique também a caixa de spam.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="eyebrow block mb-2">Email</span>
                <input
                  type="email"
                  required
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-foreground/40 focus:border-primary focus:outline-none py-2 text-foreground"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="mt-3 w-full bg-primary text-primary-foreground py-4 text-sm font-semibold uppercase tracking-[0.18em] disabled:opacity-60"
              >
                {busy ? "Enviando…" : "Enviar link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-sm text-muted-foreground">
            <Link to="/login" className="text-primary underline underline-offset-4">
              Voltar para o login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
