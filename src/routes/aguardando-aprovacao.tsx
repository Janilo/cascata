import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/aguardando-aprovacao")({
  component: PendingPage,
});

function PendingPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate({ to: "/login" });
        return;
      }
      setEmail(data.user.email || "");
      const { data: p } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", data.user.id)
        .maybeSingle();
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const isAdmin = (roles || []).some((r) => r.role === "admin");
      if (p?.is_approved || isAdmin) {
        navigate({ to: "/waterfall" });
      }
    })();
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-10">
      <div className="max-w-xl w-full space-y-6">
        <Link to="/" className="block">
          <span className="font-display text-3xl text-primary">Cascata</span>
          <p className="eyebrow mt-1">por J P Saraiva</p>
        </Link>
        <div className="border border-border bg-card p-8 space-y-4">
          <p className="eyebrow">ACESSO PENDENTE</p>
          <h1 className="font-display text-3xl text-primary">Aguardando aprovação</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sua conta <span className="font-mono text-foreground">{email}</span> foi criada, mas ainda
            não foi aprovada por um administrador. Você receberá acesso assim que a aprovação for concedida.
          </p>
          <p className="text-sm text-muted-foreground">
            Se precisar de acesso urgente, entre em contato com o administrador da plataforma.
          </p>
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground px-6 py-2 text-xs uppercase tracking-[0.18em] font-semibold hover:opacity-90"
            >
              Verificar novamente
            </button>
            <button
              onClick={logout}
              className="text-xs uppercase tracking-[0.18em] font-semibold text-muted-foreground hover:text-foreground"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
