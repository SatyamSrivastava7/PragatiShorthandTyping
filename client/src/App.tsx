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
import PitmanTestPage from "@/pages/pitman-test";
import AllahabadHCTestPage from "@/pages/allahabad-hc-test";
import HighCourtAdminPage from "@/pages/high-court-admin";
import HighCourtTypingTestPage from "@/pages/high-court-typing-test";
import HighCourtPitmanTestPage from "@/pages/high-court-pitman-test";
import HighCourtShorthandTestPage from "@/pages/high-court-shorthand-test";
import LandingPage from "@/pages/landing";
import ContactPage from "@/pages/contact";
import { Layout } from "@/components/layout";
import { useAuth, useContentById } from "@/lib/hooks";
import GalleryPage from "@/pages/gallery";
import SelectedCandidatesPage from "@/pages/selected-candidates";
import NoticesPage from "@/pages/notice";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";

// Dynamic test router that determines which test page to render
function TestRouter() {
  const [, params] = useRoute("/test/:id");
  const { data: testContent, isLoading } = useContentById(params?.id ? Number(params.id) : undefined);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading test...</span>
      </div>
    );
  }

  // Route to appropriate test page based on type
  if (testContent?.type === 'pitman') {
    return <PitmanTestPage />;
  }
  if (testContent?.type === 'allahabad-hc') {
    return <AllahabadHCTestPage />;
  }

  // Default to the established typing/shorthand page for legacy test content only.
  return <TypingTestPage />;
}

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
            <Route path="/notice" component={NoticesPage} />
            <Route path="/selected-candidates" component={SelectedCandidatesPage} />
            
            {/* Protected Routes */}
            <Route path="/admin">
              <PrivateRoute component={AdminDashboard} allowedRoles={['admin']} />
            </Route>
            <Route path="/admin/high-court">
              <PrivateRoute component={HighCourtAdminPage} allowedRoles={['admin']} />
            </Route>
            <Route path="/student">
              <PrivateRoute component={StudentDashboard} allowedRoles={['student']} />
            </Route>
            <Route path="/high-court/typing/:id">
              <PrivateRoute component={HighCourtTypingTestPage} allowedRoles={['student']} />
            </Route>
            <Route path="/high-court/pitman/:id">
              <PrivateRoute component={HighCourtPitmanTestPage} allowedRoles={['student']} />
            </Route>
            <Route path="/high-court/shorthand/:id">
              <PrivateRoute component={HighCourtShorthandTestPage} allowedRoles={['student']} />
            </Route>
            <Route path="/test/:id">
              <PrivateRoute component={TestRouter} allowedRoles={['student']} />
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
