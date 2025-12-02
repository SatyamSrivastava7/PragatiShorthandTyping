import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import AdminDashboard from "@/pages/admin-dashboard";
import UserDashboard from "@/pages/user-dashboard";
import TypingTestPage from "@/pages/typing-test";
import { Layout } from "@/components/layout";
import { useStore } from "@/lib/store";

function ProtectedRoute({ component: Component, role }: { component: any, role?: 'admin' | 'user' }) {
  const { currentUser } = useStore();

  if (!currentUser) {
    return <Redirect to="/auth" />;
  }

  if (role && currentUser.role !== role) {
    return <Redirect to={currentUser.role === 'admin' ? '/admin' : '/dashboard'} />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} role="admin" />
      </Route>
      
      <Route path="/dashboard">
        <ProtectedRoute component={UserDashboard} role="user" />
      </Route>

      <Route path="/test/:id">
        <ProtectedRoute component={TypingTestPage} role="user" />
      </Route>

      <Route path="/">
        <Redirect to="/auth" />
      </Route>

      <Route component={NotFound} />
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
