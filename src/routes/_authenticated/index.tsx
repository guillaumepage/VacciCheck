import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stethoscope, User as UserIcon, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

function Home() {
  const { user, isAdmin } = useAuth();
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Bienvenue{user?.email ? `, ${user.email}` : ""}</h1>
        <p className="text-muted-foreground mt-2">Accédez à l'outil de recommandations vaccinales et à votre profil.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Stethoscope className="h-5 w-5" />
            </div>
            <CardTitle>VacciCheck</CardTitle>
            <CardDescription>Téléverse un carnet de vaccination PDF et extrait toutes les entrées avec l'IA.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm"><Link to="/vaccicheck">Ouvrir VacciCheck</Link></Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
              <UserIcon className="h-5 w-5" />
            </div>
            <CardTitle>Mon profil</CardTitle>
            <CardDescription>Complétez vos informations professionnelles.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm"><Link to="/profil">Gérer mon profil</Link></Button>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="hover:shadow-md transition-shadow sm:col-span-2 border-primary/30">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle>Console administrateur</CardTitle>
              <CardDescription>Gérer les usagers et réinitialiser les mots de passe.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm"><Link to="/admin">Ouvrir la console</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
