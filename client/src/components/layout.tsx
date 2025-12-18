import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut, Menu, Home, Phone, LogIn, Mail, MapPin } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import logoImage from '../assets/logo.jpeg';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user: currentUser, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
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
      <header className="w-full bg-white/95 backdrop-blur-md border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu size={24} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <div className="p-6 border-b flex items-center gap-2">
                   <img src={logoImage} alt="Pragati Logo" className="h-12 w-12 object-contain rounded-full" />
                   <h1 className="text-xl font-bold text-gray-900 tracking-tight">Pragati<br/><span className="text-sm font-normal text-muted-foreground">Institute</span></h1>
                </div>
                <NavContent />
              </SheetContent>
            </Sheet>
            
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 shadow-md bg-white hidden md:block">
                  <img src={logoImage} alt="Pragati Logo" className="w-full h-full object-contain" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="font-bold text-lg text-gray-900 leading-tight">Pragati Institute</h1>
                  <p className="text-xs text-muted-foreground">Professional Studies, Prayagraj</p>
                </div>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-6">
            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className={cn("text-sm font-medium hover:text-primary transition-colors", location === "/" ? "text-primary" : "text-gray-600")}>Home</Link>
              <Link href="/contact" className={cn("text-sm font-medium hover:text-primary transition-colors", location === "/contact" ? "text-primary" : "text-gray-600")}>Contact Us</Link>
              {currentUser && (
                 <Link href={currentUser.role === 'admin' ? "/admin" : "/student"} className={cn("text-sm font-medium hover:text-primary transition-colors", location.includes("/admin") || location.includes("/student") ? "text-primary" : "text-gray-600")}>
                   Dashboard
                 </Link>
              )}
            </nav>

            {currentUser ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-right">
                   <div className="hidden md:block">
                    <p className="text-sm font-medium leading-none text-gray-900">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{currentUser.role}</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
                    {currentUser.name.charAt(0)}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout} className="text-gray-600 hover:text-destructive hover:border-destructive">
                  <LogOut size={16} className="mr-1.5" />
                  <span className="hidden md:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button className="bg-gradient-to-r from-primary to-blue-600 shadow-md hover:shadow-lg transition-all">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto bg-slate-50 flex flex-col">
            <div className="flex-1">
              {children}
            </div>
            
            {/* Footer - Now Global */}
            <footer className="w-full py-12 bg-slate-300 text-slate-600 shrink-0 border-t border-slate-200">
              <div className="container px-4 md:px-6 mx-auto">
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                   <div className="space-y-4">
                     <h4 className="text-xl font-bold text-slate-900 tracking-tight">Pragati Institute</h4>
                     <p className="text-sm text-slate-600 leading-relaxed">
                       Empowering careers through professional skill development since 2008. Your success is our mission.
                     </p>
                   </div>
                   <div className="space-y-4">
                     <h4 className="text-lg font-bold text-slate-900">Contact</h4>
                     <ul className="space-y-3 text-sm text-slate-600">
                       <li className="flex items-center gap-3 hover:text-primary transition-colors">
                         <div className="p-1.5 bg-white shadow-sm rounded-md border border-slate-200">
                           <Mail size={14} className="text-primary" /> 
                         </div>
                         <span className="truncate">pragatiprofessionalstudies@gmail.com</span>
                       </li>
                       <li className="flex items-center gap-3 hover:text-primary transition-colors">
                         <div className="p-1.5 bg-white shadow-sm rounded-md border border-slate-200">
                           <Phone size={14} className="text-primary" /> 
                         </div>
                         +91 9026212705
                       </li>
                     </ul>
                   </div>
                   <div className="space-y-4 col-span-2">
                     <h4 className="text-lg font-bold text-slate-900">Visit Us</h4>
                     <div className="flex items-start gap-3 text-sm text-slate-600 group">
                       <div className="p-1.5 bg-white shadow-sm rounded-md mt-0.5 border border-slate-200 group-hover:border-primary/50 transition-colors">
                         <MapPin size={16} className="text-primary" />
                       </div>
                       <p className="leading-relaxed">
                         Kalindipuram, Rajrooppur, Prayagraj,<br/> 
                         Uttar Pradesh, India, 211011
                       </p>
                     </div>
                   </div>
                </div>
                <div className="mt-12 border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
                  <p>© 2024 Pragati Professional Studies. All rights reserved.</p>
                  <p>Designed for Excellence</p>
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
