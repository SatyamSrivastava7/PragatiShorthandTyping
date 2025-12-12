import { Link, useLocation } from "wouter";
import { useMockStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut, FileText, UserCircle } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useMockStore();
  const [location, setLocation] = useLocation();

  if (!currentUser) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-primary tracking-tight">Pragati<br/><span className="text-sm font-normal text-sidebar-foreground">Shorthand & Typing</span></h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {currentUser.role === 'admin' ? (
            <Link href="/admin">
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer",
                location === "/admin" 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <LayoutDashboard size={20} />
                Dashboard
              </div>
            </Link>
          ) : (
             <Link href="/student">
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer",
                location === "/student" 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <LayoutDashboard size={20} />
                Dashboard
              </div>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{currentUser.role}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b flex items-center justify-between px-4 bg-card">
           <h1 className="text-lg font-bold text-primary">Pragati</h1>
           <Button variant="ghost" size="icon" onClick={handleLogout}>
             <LogOut size={20} />
           </Button>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
