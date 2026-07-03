import { describe, it, expect, vi, beforeEach } from "vitest";
import { ADMIN_EMAIL } from "./config";

// Stub do client: profiles → .select().eq().maybeSingle(); user_roles →
// .select().eq() awaitado direto (thenable).
const h = vi.hoisted(() => ({
  profile: null as { is_approved: boolean } | null,
  roles: [] as Array<{ role: string }>,
}));

vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          if (table === "profiles") {
            return { maybeSingle: async () => ({ data: h.profile, error: null }) };
          }
          return {
            then: (
              resolve: (v: { data: Array<{ role: string }>; error: null }) => unknown,
              reject?: (e: unknown) => unknown,
            ) => Promise.resolve({ data: h.roles, error: null }).then(resolve, reject),
          };
        },
      }),
    }),
  },
}));

import { getAccessState } from "./access";

beforeEach(() => {
  h.profile = null;
  h.roles = [];
});

describe("getAccessState — o predicado 'admin OU aprovado' num lugar só (A5)", () => {
  it("role admin entra mesmo sem aprovação no perfil", async () => {
    h.roles = [{ role: "admin" }];
    h.profile = { is_approved: false };

    const s = await getAccessState({ id: "u1", email: "x@y.com" });
    expect(s).toEqual({ isAdmin: true, isApproved: false, canAccess: true });
  });

  it("ADMIN_EMAIL é bypass de bootstrap mesmo sem role", async () => {
    const s = await getAccessState({ id: "u1", email: ADMIN_EMAIL });
    expect(s.isAdmin).toBe(true);
    expect(s.canAccess).toBe(true);
  });

  it("usuário comum aprovado passa no gate sem ser admin", async () => {
    h.profile = { is_approved: true };

    const s = await getAccessState({ id: "u2", email: "aprovado@empresa.com" });
    expect(s).toEqual({ isAdmin: false, isApproved: true, canAccess: true });
  });

  it("usuário comum pendente fica barrado", async () => {
    h.profile = { is_approved: false };

    const s = await getAccessState({ id: "u3", email: "pendente@empresa.com" });
    expect(s).toEqual({ isAdmin: false, isApproved: false, canAccess: false });
  });

  it("sem perfil ainda (primeiro login) → barrado, não crash", async () => {
    const s = await getAccessState({ id: "u4" });
    expect(s.canAccess).toBe(false);
  });
});
