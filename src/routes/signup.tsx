import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Criar conta — Cascata" },
      { name: "description", content: "Crie sua conta Cascata em 1 minuto. Cada departamento alimenta as linhas do waterfall que conhece, com aprovação por administrador." },
      { property: "og:title", content: "Criar conta — Cascata" },
      { property: "og:description", content: "Crie sua conta Cascata em 1 minuto e abra o price waterfall por cliente." },
      { property: "og:url", content: "https://cascata.pereirasaraiva.com/signup" },
    ],
    links: [
      { rel: "canonical", href: "https://cascata.pereirasaraiva.com/signup" },
    ],
  }),
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    navigate({ to: "/waterfall" });
  };

  const onGoogle = async () => {
    setErr(null);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { setErr(result.error.message); return; }
    if (result.redirected) return;
    navigate({ to: "/waterfall" });
  };


  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-1/2 bg-primary text-primary-foreground p-16 flex-col justify-between" aria-hidden="true">
        <Link to="/" className="font-display text-2xl">Cascata</Link>
        <div>
          <p className="eyebrow !text-[var(--gold)] mb-6">CRIAR CONTA</p>
          <p className="font-display text-5xl italic leading-tight">
            Cada departamento<br/>vê só o seu pedaço<br/>do waterfall.
          </p>
        </div>
        <a href="https://pereirasaraiva.com" target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-[0.18em] opacity-60">por J P Saraiva</a>
      </aside>
      <main className="flex-1 flex items-center justify-center p-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <p className="eyebrow mb-6">NOVA CONTA</p>
          <h1 className="font-display text-4xl text-primary mb-10">Comece em 1 minuto.</h1>
          <div className="space-y-5">
            <Field label="Nome completo" type="text" value={fullName} onChange={setFullName} required />
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <Field label="Senha" type="password" value={password} onChange={setPassword} required />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Seu departamento será atribuído por um administrador após a aprovação da conta.
          </p>
          {err && <p className="text-xs text-destructive mt-4">{err}</p>}
          <button type="submit" disabled={loading} className="mt-8 w-full bg-primary text-primary-foreground py-4 text-sm font-semibold uppercase tracking-[0.18em] disabled:opacity-60">
            {loading ? "Criando…" : "Criar conta"}
          </button>
          <button type="button" onClick={onGoogle} className="mt-3 w-full border border-foreground/20 py-4 text-sm font-semibold uppercase tracking-[0.18em] hover:bg-foreground/5">
            Entrar com Google
          </button>

          <p className="mt-6 text-sm text-muted-foreground">
            Já tem conta? <Link to="/login" className="text-primary underline underline-offset-4">Entrar</Link>
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
      <input type={type} value={value} required={required} onChange={(e) => e && onChange(e.target.value)}
        className="w-full bg-transparent border-0 border-b border-foreground/40 focus:border-primary focus:outline-none py-2 text-foreground"
      />
    </label>
  );
}
