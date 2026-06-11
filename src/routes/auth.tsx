import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Connexion — VaxConseil" }] }),
});

const emailSchema = z.string().trim().email("Courriel invalide").max(255);
const passwordSchema = z.string().min(8, "Au moins 8 caractères").max(128);
const nameSchema = z.string().trim().min(1, "Requis").max(100);

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">VaxConseil</h1>
          <p className="text-sm text-muted-foreground mt-1">Outil de recommandations vaccinales</p>
        </div>

        <Card className="border-border/60 shadow-xl">
          <Tabs defaultValue="signin">
            <CardHeader className="pb-2">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
                <TabsTrigger value="forgot">Oublié</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-6">
              <TabsContent value="signin" className="mt-0"><SignInForm /></TabsContent>
              <TabsContent value="signup" className="mt-0"><SignUpForm /></TabsContent>
              <TabsContent value="forgot" className="mt-0"><ForgotForm /></TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      if (!password) throw new Error("Mot de passe requis");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Entrée invalide");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "Courriel ou mot de passe incorrect"
        : error.message);
      return;
    }
    toast.success("Connexion réussie");
    navigate({ to: "/" });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="si-email">Courriel</Label>
        <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="si-pwd">Mot de passe</Label>
        <Input id="si-pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Se connecter
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      nameSchema.parse(firstName);
      nameSchema.parse(lastName);
    } catch (err) {
      toast.error(err instanceof z.ZodError ? err.issues[0].message : "Entrée invalide");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { first_name: firstName, last_name: lastName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Compte créé. Vous pouvez maintenant vous connecter.");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="su-fn">Prénom</Label>
          <Input id="su-fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="su-ln">Nom</Label>
          <Input id="su-ln" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email">Courriel</Label>
        <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-pwd">Mot de passe</Label>
        <Input id="su-pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
        <p className="text-xs text-muted-foreground">Au moins 8 caractères.</p>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Créer mon compte
      </Button>
    </form>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { emailSchema.parse(email); } catch { toast.error("Courriel invalide"); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Un courriel de réinitialisation a été envoyé si ce compte existe.");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <CardDescription>Entrez votre courriel pour recevoir un lien de réinitialisation.</CardDescription>
      <div className="space-y-2">
        <Label htmlFor="fp-email">Courriel</Label>
        <Input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Envoyer le lien
      </Button>
    </form>
  );
}
