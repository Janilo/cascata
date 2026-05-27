import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Upload, Network, Users, LogOut, TrendingDown, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const [name, setName] = useState<string>("");
  const [dept, setDept] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase.from("profiles").select("full_name,department").eq("id", u.user.id).maybeSingle();
      setName(p?.full_name || u.user.email || "");
      setDept(p?.department || "");
    })();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const navItems = [
    { to: "/waterfall", label: "Waterfall", icon: BarChart3 },
    { to: "/inputs", label: "Inputs", icon: Upload },
    { to: "/organograma", label: "Organograma", icon: Network },
    { to: "/clientes", label: "Clientes", icon: Users },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <Link to="/" className="p-6 border-b border-border">
          <span className="font-display text-2xl text-primary">Cascata</span>
          <p className="eyebrow mt-1">por J P Saraiva</p>
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
