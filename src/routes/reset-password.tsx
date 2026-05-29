import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CascataWordmark } from "@/components/brand/CascataWordmark";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Cascata" }, { name: "robots", content: "noindex" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Senha precisa ter ao menos 6 caracteres."); return; }
    if (password !== confirm) { toast.error("As senhas não coincidem."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha atualizada.");
    navigate({ to: "/waterfall" });
  };

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-1/2 bg-primary text-primary-foreground p-16 flex-col justify-between" aria-hidden="true">
        <Link to="/" aria-label="Cascata" className="text-primary-foreground">
          <CascataWordmark height={28} className="!text-current" />
        </Link>
        <div>
          <p className="eyebrow !text-[var(--gold)] mb-6">PRICING · WATERFALL</p>
          <p className="font-display text-5xl italic leading-tight">
            Nova senha.<br />Novo acesso.
          </p>
        </div>
        <a href="https://pereirasaraiva.com" target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-[0.18em] opacity-60">por J P Saraiva</a>
      </aside>

      <main className="flex-1 flex items-center justify-center p-12">
        <div className="w-full max-w-sm">
          <p className="eyebrow mb-6">NOVA SENHA</p>
          <h1 className="font-display text-4xl text-primary mb-10">Redefinir senha.</h1>

          {!ready ? (
            <p className="text-sm text-muted-foreground">
              Validando seu link… Se esta página não avançar em alguns segundos, o link pode ter expirado.
              <br />
              <Link to="/forgot-password" className="mt-3 inline-block text-primary underline underline-offset-4">Pedir novo link</Link>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="eyebrow block mb-2">Nova senha</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Mín. 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-foreground/40 focus:border-primary focus:outline-none py-2 pr-8 text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="eyebrow block mb-2">Confirmar nova senha</span>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Repetir senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full bg-transparent border-0 border-b border-foreground/40 focus:border-primary focus:outline-none py-2 pr-8 text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 flex items-center text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="mt-3 w-full bg-primary text-primary-foreground py-4 text-sm font-semibold uppercase tracking-[0.18em] disabled:opacity-60"
              >
                {busy ? "Salvando…" : "Salvar nova senha"}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
