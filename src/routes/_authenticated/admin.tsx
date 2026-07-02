import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listUsers, sendPasswordReset, toggleUserActive, setUserRole,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Mail, ShieldOff, ShieldCheck, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.replace("https://conseilsv.lovable.app");
      throw redirect({ to: "/" });
    }
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!data) throw redirect({ to: "/" });
  },
  component: AdminPage,
  head: () => ({ meta: [{ title: "Administration — VaxConseil" }] }),
});


function AdminPage() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listUsers);
  const reset = useServerFn(sendPasswordReset);
  const toggle = useServerFn(toggleUserActive);
  const role = useServerFn(setUserRole);
  const [filter, setFilter] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
  });

  const resetMut = useMutation({
    mutationFn: (email: string) => reset({ data: { email, redirectTo: `${window.location.origin}/reset-password` } }),
    onSuccess: () => toast.success("Courriel de réinitialisation envoyé"),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { userId: string; isActive: boolean }) => toggle({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Mis à jour"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "user"; grant: boolean }) => role({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Rôle mis à jour"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u: any) => {
    const t = filter.toLowerCase();
    return !t || [u.email, u.first_name, u.last_name, u.organization, u.profession]
      .filter(Boolean).some((v: string) => v.toLowerCase().includes(t));
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Console administrateur</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestion des comptes usagers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usagers ({users.length})</CardTitle>
          <CardDescription>
            Les administrateurs n'ont jamais accès aux mots de passe. La réinitialisation envoie un courriel sécurisé à l'usager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher…" value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Courriel</TableHead>
                    <TableHead>Profession</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Rôles</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u: any) => {
                    const isAdmin = (u.roles ?? []).includes("admin");
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                        <TableCell className="text-sm">{u.email}</TableCell>
                        <TableCell className="text-sm">{u.profession ?? "—"}{u.license_number ? ` (${u.license_number})` : ""}</TableCell>
                        <TableCell className="text-sm">{u.organization ?? "—"}</TableCell>
                        <TableCell>
                          {isAdmin ? <Badge>Admin</Badge> : <Badge variant="secondary">Usager</Badge>}
                        </TableCell>
                        <TableCell>
                          {u.is_active ? <Badge variant="outline" className="text-green-700 border-green-300">Actif</Badge>
                            : <Badge variant="outline" className="text-destructive border-destructive/40">Désactivé</Badge>}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="outline" disabled={resetMut.isPending} onClick={() => resetMut.mutate(u.email)}>
                            <Mail className="h-3 w-3" />Réinitialiser
                          </Button>
                          <Button size="sm" variant="outline" disabled={roleMut.isPending}
                            onClick={() => roleMut.mutate({ userId: u.id, role: "admin", grant: !isAdmin })}>
                            {isAdmin ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                            {isAdmin ? "Retirer admin" : "Promouvoir"}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={toggleMut.isPending}
                            onClick={() => toggleMut.mutate({ userId: u.id, isActive: !u.is_active })}>
                            {u.is_active ? "Désactiver" : "Activer"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
