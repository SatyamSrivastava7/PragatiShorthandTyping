import { Link, useLocation } from "wouter";
import { useMockStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut, Menu, Home, Phone, LogIn } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import logoImage from '@assets/generated_images/minimalist_blue_abstract_logo_with_p_letter_mark.png';

export function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useMockStore();
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const NavContent = () => (
    <nav className="flex-1 p-4 space-y-2">
      <Link href="/">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer",
          location === "/" 
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}>
          <Home size={20} />
          Home
        </div>
      </Link>
      
      <Link href="/contact">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer",
          location === "/contact" 
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}>
          <Phone size={20} />
          Contact Us
        </div>
      </Link>

      {currentUser && (
        <>
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
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-6 shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu size={24} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <div className="p-6 border-b flex items-center gap-2">
                 <img src={logoImage} alt="Pragati Logo" className="h-8 w-8 object-contain" />
                 <h1 className="text-xl font-bold text-primary tracking-tight">Pragati<br/><span className="text-sm font-normal text-muted-foreground">Shorthand & Typing</span></h1>
              </div>
              <NavContent />
            </SheetContent>
          </Sheet>
          
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={logoImage} alt="Pragati Logo" className="h-10 w-10 object-contain hidden md:block" />
              <h1 className="text-lg md:text-xl font-bold text-primary tracking-tight">
                Pragati <span className="hidden md:inline font-normal text-muted-foreground">| Shorthand & Typing</span>
              </h1>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6 mr-4 text-sm font-medium">
            <Link href="/" className={cn("hover:text-primary transition-colors", location === "/" ? "text-primary" : "text-muted-foreground")}>Home</Link>
            <Link href="/contact" className={cn("hover:text-primary transition-colors", location === "/contact" ? "text-primary" : "text-muted-foreground")}>Contact Us</Link>
            {currentUser && (
               <Link href={currentUser.role === 'admin' ? "/admin" : "/student"} className={cn("hover:text-primary transition-colors", location.includes("/admin") || location.includes("/student") ? "text-primary" : "text-muted-foreground")}>
                 Dashboard
               </Link>
            )}
          </div>

          {currentUser ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-right">
                 <div className="hidden md:block">
                  <p className="text-sm font-medium leading-none">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">{currentUser.role}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {currentUser.name.charAt(0)}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                <LogOut size={18} className="mr-2" />
                <span className="hidden md:inline">Logout</span>
              </Button>
            </div>
          ) : (
            <Link href="/auth">
              <Button>
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto bg-slate-50">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
