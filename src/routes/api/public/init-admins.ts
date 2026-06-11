import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/init-admins")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Refuse if any admin already exists
        const { data: existing } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1);
        if (existing && existing.length > 0) {
          return Response.json({ ok: true, message: "Admins already initialized", skipped: true });
        }

        const admins = [
          { email: "guillaume.page09@gmail.com", first_name: "Guillaume", last_name: "Pagé" },
          { email: "noemie.duval@hotmail.com", first_name: "Noémie", last_name: "Duval" },
        ];
        const results: any[] = [];
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

        for (const a of admins) {
          let userId = list?.users.find((u) => u.email?.toLowerCase() === a.email.toLowerCase())?.id;
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
            first_name: a.first_name, last_name: a.last_name,
          }).eq("id", userId);
          const { error: re } = await supabaseAdmin.from("user_roles")
            .insert({ user_id: userId, role: "admin" });
          results.push({ email: a.email, ok: !re || re.message.includes("duplicate") });
        }
        return Response.json({ ok: true, results });
      },
    },
  },
});
