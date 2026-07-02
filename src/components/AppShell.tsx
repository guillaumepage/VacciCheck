import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

import { Button } from "@/components/ui/button";
import { Shield, User as UserIcon, LogOut, Users as UsersIcon, Stethoscope } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    sessionStorage.removeItem("vc_gate_session");
    window.location.replace("https://conseilsv.lovable.app");
  };


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Shield className="h-4 w-4" />
            </div>
            VaxConseil
          </Link>
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/vaccicheck"><Stethoscope className="h-4 w-4" />VacciCheck</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/profil"><UserIcon className="h-4 w-4" />Profil</Link>
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin"><UsersIcon className="h-4 w-4" />Admin</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />Déconnexion
            </Button>
          </nav>
        </div>
        {user && (
          <div className="container mx-auto px-4 pb-2 text-xs text-muted-foreground">
            Connecté en tant que <span className="font-medium text-foreground">{user.email}</span>
            {isAdmin && <span className="ml-2 inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">Administrateur</span>}
          </div>
        )}
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
