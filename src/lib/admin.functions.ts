import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Vérification du rôle a échoué");
  if (!data) throw new Error("Accès refusé : administrateur requis");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles, error: pErr }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (pErr) throw new Error(pErr.message);

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const lastSignIn = new Map(authUsers.users.map((u) => [u.id, u.last_sign_in_at]));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });

    return (profiles ?? []).map((p: any) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
      last_sign_in_at: lastSignIn.get(p.id) ?? null,
    }));
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; redirectTo: string }) =>
    z.object({
      email: z.string().email().max(255),
      redirectTo: z.string().url().max(500),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; isActive: boolean }) =>
    z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: pe } = await supabaseAdmin.from("profiles").update({ is_active: data.isActive }).eq("id", data.userId);
    if (pe) throw new Error(pe.message);
    const { error: ae } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.isActive ? "none" : "876000h",
    });
    if (ae) throw new Error(ae.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "user"; grant: boolean }) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "user"]),
      grant: z.boolean(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin.from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("user_roles")
        .delete().eq("user_id", data.userId).eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const seedAdmins = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admins = [
    { email: "guillaume.page09@gmail.com", first_name: "Guillaume", last_name: "Pagé" },
    { email: "noemie.duval@hotmail.com", first_name: "Noémie", last_name: "Duval" },
  ];
  const results: any[] = [];
  for (const a of admins) {
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    let userId = existing.users.find((u) => u.email?.toLowerCase() === a.email.toLowerCase())?.id;
    if (!userId) {
      const { data: created, error: ce } = await supabaseAdmin.auth.admin.createUser({
        email: a.email,
        password: "admin",
        email_confirm: true,
        user_metadata: { first_name: a.first_name, last_name: a.last_name },
      });
      if (ce) { results.push({ email: a.email, error: ce.message }); continue; }
      userId = created.user.id;
    }
    await supabaseAdmin.from("profiles").update({
      first_name: a.first_name,
      last_name: a.last_name,
    }).eq("id", userId);
    const { error: re } = await supabaseAdmin.from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (re && !re.message.includes("duplicate")) results.push({ email: a.email, error: re.message });
    else results.push({ email: a.email, ok: true });
  }
  return { results };
});
