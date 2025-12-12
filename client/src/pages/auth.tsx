import { useState } from "react";
import { useLocation } from "wouter";
import { useMockStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { login, registerStudent } = useMockStore();
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 500));

    if (login(loginId, loginMobile)) {
      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });
      // Redirect based on role is handled by Layout/App, but we need to push to correct path
      // Checking role is tricky here without accessing store state immediately after update
      // But we can check the input
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
      registerStudent({
        name: regName,
        mobile: regMobile,
        batch: regBatch,
        studentId: regStudentId,
        email: regEmail
      });
      toast({
        title: "Registration Successful",
        description: "You can now login with your Student ID.",
      });
      // Switch to login tab
      // For now just clear form or let user switch manually
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
