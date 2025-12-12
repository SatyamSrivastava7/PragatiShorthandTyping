import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import AdminDashboard from "@/pages/admin-dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import TypingTestPage from "@/pages/typing-test";
import { Layout } from "@/components/layout";
import { StoreProvider } from "@/lib/store";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={AuthPage} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/student" component={StudentDashboard} />
        <Route path="/test/:id" component={TypingTestPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </StoreProvider>
    </QueryClientProvider>
  );
}

export default App;
