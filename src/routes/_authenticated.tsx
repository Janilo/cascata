import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Upload, Network, Users, LogOut, TrendingDown, ShieldCheck, LineChart, History } from "lucide-react";
import { CascataWordmark } from "@/components/brand/CascataWordmark";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    // Check approval status (admins bypass)
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("is_approved").eq("id", data.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    ]);
    const isAdmin = (roles || []).some((r) => r.role === "admin");
    if (!isAdmin && !profile?.is_approved) {
      throw redirect({ to: "/aguardando-aprovacao" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const [name, setName] = useState<string>("");
  const [dept, setDept] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name,department").eq("id", u.user.id).maybeSingle();
      setName(p?.full_name || u.user.email || "");
      setDept(p?.department || "");
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setIsAdmin((roles || []).some(r => r.role === "admin"));
    })();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const navItems = [
    { to: "/waterfall", label: "Waterfall", icon: BarChart3 },
    { to: "/comparativo", label: "Comparativo", icon: LineChart },
    { to: "/inputs", label: "Inputs", icon: Upload },
    { to: "/custo-de-servir", label: "Custo de servir", icon: TrendingDown },
    { to: "/organograma", label: "Organograma", icon: Network },
    { to: "/clientes", label: "Clientes", icon: Users },
    ...(isAdmin ? [
      { to: "/auditoria", label: "Auditoria", icon: History },
      { to: "/admin", label: "Admin", icon: ShieldCheck },
    ] : []),
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <Link to="/" className="p-6 border-b border-border flex flex-col gap-1" aria-label="Cascata — início">
          <CascataWordmark height={28} />
          <a href="https://pereirasaraiva.com" target="_blank" rel="noopener noreferrer" className="eyebrow mt-1">por J P Saraiva</a>
        </Link>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              inactiveProps={{ className: "hover:bg-secondary" }}
              className="flex items-center gap-3 px-4 py-3 text-sm uppercase tracking-[0.12em] font-semibold transition-colors"
            >
              <it.icon className="w-4 h-4" />
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.1em] mb-3">{dept || "—"}</p>
          <button onClick={logout} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground uppercase tracking-[0.12em]">
            <LogOut className="w-3 h-3" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
