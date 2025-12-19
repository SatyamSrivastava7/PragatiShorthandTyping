import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import AdminLoginPage from "@/pages/adminlogin";
import AdminDashboard from "@/pages/admin-dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import TypingTestPage from "@/pages/typing-test";
import LandingPage from "@/pages/landing";
import ContactPage from "@/pages/contact";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/hooks";
import GalleryPage from "@/pages/gallery";
import SelectedCandidatesPage from "@/pages/selected-candidates";

function PrivateRoute({ component: Component, allowedRoles }: { component: React.ComponentType, allowedRoles: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    // Redirect to appropriate login page based on required role
    const isAdminRoute = allowedRoles.includes('admin') && !allowedRoles.includes('student');
    return <Redirect to={isAdminRoute ? "/adminlogin" : "/auth"} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Redirect to={user.role === 'admin' ? "/admin" : "/student"} />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      {/* Landing page has its own header/footer */}
      <Route path="/" component={LandingPage} />
      
      {/* All other routes use the Layout */}
      <Route>
        <Layout>
          <Switch>
            {/* Public Routes */}
            <Route path="/auth" component={AuthPage} />
            <Route path="/adminlogin" component={AdminLoginPage} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/gallery" component={GalleryPage} />
            <Route path="/selected-candidates" component={SelectedCandidatesPage} />
            
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
      </Route>
    </Switch>
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
