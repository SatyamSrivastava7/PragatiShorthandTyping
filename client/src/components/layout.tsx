import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { LogOut, User } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useStore();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <header className="border-b bg-card sticky top-0 z-10 no-print">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
              P
            </div>
            <h1 className="font-bold text-lg hidden sm:block tracking-tight">Pragati Institute</h1>
          </div>

          {currentUser && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                <User className="h-4 w-4" />
                <span className="font-medium text-foreground">{currentUser.username}</span>
                <span className="text-xs uppercase tracking-wider font-bold text-primary/80 border-l pl-2 ml-2 border-border">
                  {currentUser.role}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                <LogOut className="h-5 w-5 text-muted-foreground hover:text-destructive transition-colors" />
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
