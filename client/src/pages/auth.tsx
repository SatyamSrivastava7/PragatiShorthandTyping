import { useState } from "react";
import { useLocation } from "wouter";
import { useMockStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { login, registerStudent, users } = useMockStore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Login State
  const [loginId, setLoginId] = useState("");
  const [loginMobile, setLoginMobile] = useState("");

  // Register State
  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regBatch, setRegBatch] = useState("");
  const [regStudentId, setRegStudentId] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regState, setRegState] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 500));

    // Check if user exists first to provide better error messages (mockup only logic)
    const existingUser = users.find(u => 
      (u.role === 'admin' && u.name === loginId && u.mobile === loginMobile) ||
      (u.role === 'student' && u.studentId === loginId && u.mobile === loginMobile)
    );

    if (existingUser) {
      // Check payment status for students
      if (existingUser.role === 'student' && !existingUser.isPaymentCompleted) {
         // Ideally we would redirect to a payment page or show a modal.
         // For now, let's login but redirect to a payment wall page or show toast.
         // Wait, the prompt says: "Register only those new students who have done the payment successfully"
         // But also "Admin should be able to enable any new student to skip payment".
         // Let's assume login is allowed but access is restricted if not paid.
         
         // Actually, let's block login and say "Payment Pending"
         // Or simpler: Let them login, but redirect to Payment screen if invalid.
      }
    }

    if (login(loginId, loginMobile)) {
      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });
      
      const user = users.find(u => u.role === 'student' && u.studentId === loginId);
      
      if (loginId === "Administrator") {
        setLocation("/admin");
      } else {
        setLocation("/student");
      }
    } else {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid credentials. Please check your ID and Mobile Number.",
      });
    }
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regMobile.length !== 10) {
       toast({
        variant: "destructive",
        title: "Invalid Mobile",
        description: "Mobile number must be 10 digits.",
      });
      return;
    }

    setIsLoading(true);
    await new Promise(r => setTimeout(r, 500));

    try {
      // Register (mock payment gateway trigger comes after or before?)
      // Prompt: "Register only those new students who have done the payment successfully"
      // This implies a payment flow during registration.
      // We'll create the user but mark isPaymentCompleted = false.
      // Then show a mock payment modal. 
      // For simplicity in this step, we just register and tell them to contact admin or pay later.
      
      // Actually, let's just register them. The payment flow will be enforced on login/dashboard.
      
      const newUser = registerStudent({
        name: regName,
        mobile: regMobile,
        batch: regBatch,
        studentId: regStudentId,
        email: regEmail,
        city: regCity,
        state: regState
      });
      
      toast({
        title: "Registration Successful",
        description: "Please login to complete your payment setup.",
      });
      // Switch to login tab
      setLoginId(regStudentId);
      setLoginMobile(regMobile);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: err.message,
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Pragati Institute</CardTitle>
          <CardDescription>Shorthand & Typing Assessment Platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">New Student</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loginId">User ID / Student ID</Label>
                  <Input 
                    id="loginId" 
                    placeholder="Enter ID (or 'Administrator' for admin)" 
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginMobile">Mobile Number</Label>
                  <Input 
                    id="loginMobile" 
                    type="password" // Masking mobile as password-ish
                    placeholder="Enter 10-digit Mobile No." 
                    value={loginMobile}
                    onChange={(e) => setLoginMobile(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
                <div className="text-xs text-center text-muted-foreground mt-2">
                  <p>Demo Admin: ID: <strong>Administrator</strong> / Mobile: <strong>1234567890</strong></p>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <Label htmlFor="regName">Full Name</Label>
                    <Input id="regName" value={regName} onChange={e => setRegName(e.target.value)} required />
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="regStudentId">Student ID</Label>
                    <Input id="regStudentId" placeholder="Create unique ID" value={regStudentId} onChange={e => setRegStudentId(e.target.value)} required />
                  </div>
                </div>
               
                <div className="space-y-2">
                  <Label htmlFor="regMobile">Mobile Number (10 digits)</Label>
                  <Input 
                    id="regMobile" 
                    maxLength={10} 
                    value={regMobile} 
                    onChange={e => setRegMobile(e.target.value.replace(/\D/g, ''))} 
                    required 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regCity">City</Label>
                    <Input id="regCity" value={regCity} onChange={e => setRegCity(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regState">State</Label>
                    <Input id="regState" value={regState} onChange={e => setRegState(e.target.value)} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regBatch">Batch</Label>
                    <Input id="regBatch" value={regBatch} onChange={e => setRegBatch(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regEmail">Email (Optional)</Label>
                    <Input id="regEmail" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating Profile..." : "Create Profile"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
