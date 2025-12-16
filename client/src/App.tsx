import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import AdminDashboard from "@/pages/admin-dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import TypingTestPage from "@/pages/typing-test";
import LandingPage from "@/pages/landing";
import ContactPage from "@/pages/contact";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/hooks";
import GalleryPage from "@/pages/gallery";

function PrivateRoute({ component: Component, allowedRoles }: { component: React.ComponentType, allowedRoles: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Redirect to={user.role === 'admin' ? "/admin" : "/student"} />;
  }

  return <Component />;
}

function Router() {
  return (
    <Layout>
      <Switch>
        {/* Public Routes */}
        <Route path="/" component={LandingPage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/gallery" component={GalleryPage} />
        
        {/* Protected Routes */}
        <Route path="/admin">
          <PrivateRoute component={AdminDashboard} allowedRoles={['admin']} />
        </Route>
        <Route path="/student">
          <PrivateRoute component={StudentDashboard} allowedRoles={['student']} />
        </Route>
        <Route path="/test/:id">
          <PrivateRoute component={TypingTestPage} allowedRoles={['student']} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
