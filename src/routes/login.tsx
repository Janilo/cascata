import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { CascataWordmark } from "@/components/brand/CascataWordmark";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) || "/waterfall" }),
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Entrar — Cascata" },
      { name: "description", content: "Acesse sua conta Cascata para abrir o price waterfall por cliente, com drill-down de descontos comerciais e separação por BU." },
      { property: "og:title", content: "Entrar — Cascata" },
      { property: "og:description", content: "Acesse sua conta Cascata para abrir o price waterfall por cliente." },
      { property: "og:url", content: "https://cascata.pereirasaraiva.com/login" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [
      { rel: "canonical", href: "https://cascata.pereirasaraiva.com/login" },
    ],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    navigate({ to: redirectTo });
  };

  const onGoogle = async () => {
    setErr(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setErr(result.error.message); return; }
    if (result.redirected) return;
    navigate({ to: redirectTo });
  };


  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-1/2 bg-primary text-primary-foreground p-16 flex-col justify-between" aria-hidden="true">
        <Link to="/" aria-label="Cascata" className="text-primary-foreground"><CascataWordmark height={28} className="!text-current" /></Link>
        <div>
          <p className="eyebrow !text-[var(--gold)] mb-6">PRICING · WATERFALL</p>
          <p className="font-display text-5xl italic leading-tight">
            Entre para abrir<br/>o seu P&L<br/>por cliente.
          </p>
        </div>
        <a href="https://pereirasaraiva.com" target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-[0.18em] opacity-60">por J P Saraiva</a>
      </aside>
      <main className="flex-1 flex items-center justify-center p-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <p className="eyebrow mb-6">ENTRAR</p>
          <h1 className="font-display text-4xl text-primary mb-10">Bem-vindo de volta.</h1>
          <div className="space-y-5">
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <Field label="Senha" type="password" value={password} onChange={setPassword} required />
          </div>
          <div className="flex justify-end mt-2">
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">Esqueci a senha</Link>
          </div>
          {err && <p className="text-xs text-destructive mt-4">{err}</p>}
          <button type="submit" disabled={loading} className="mt-8 w-full bg-primary text-primary-foreground py-4 text-sm font-semibold uppercase tracking-[0.18em] disabled:opacity-60">
            {loading ? "Entrando…" : "Entrar"}
          </button>
          <button type="button" onClick={onGoogle} className="mt-3 w-full border border-foreground/20 py-4 text-sm font-semibold uppercase tracking-[0.18em] hover:bg-foreground/5">
            Entrar com Google
          </button>

          <p className="mt-6 text-sm text-muted-foreground">
            Sem conta? <Link to="/signup" className="text-primary underline underline-offset-4">Criar conta</Link>
          </p>
        </form>
      </main>
    </div>
  );
}

function Field({ label, type, value, onChange, required }: { label: string; type: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-2">{label}</span>
      <input
        type={type} value={value} required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-0 border-b border-foreground/40 focus:border-primary focus:outline-none py-2 text-foreground"
      />
    </label>
  );
}
