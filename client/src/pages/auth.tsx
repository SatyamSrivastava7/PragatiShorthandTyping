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
  const { login, registerStudent, users, resetPassword, qrCodeUrl } = useMockStore();
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

  // Reset Password State
  const [resetId, setResetId] = useState("");
  const [resetMobile, setResetMobile] = useState("");
  const [resetCity, setResetCity] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");

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
         if (!existingUser.isPaymentCompleted) {
           toast({
             variant: "destructive",
             title: "Access Denied",
             description: "Your account is pending payment verification. Please pay via QR Code or contact Admin.",
           });
           setIsLoading(false);
           return;
         }
      }
    }

    if (login(loginId, loginMobile)) {
      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });
      
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
        description: "Please pay using the QR code to activate your account.",
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 500));

    const success = resetPassword(resetId, resetMobile, resetCity, resetNewPass);
    
    if (success) {
      toast({
        title: "Password Reset Successful",
        description: "You can now login with your new password.",
      });
      setLoginId(resetId);
      setLoginMobile(resetMobile);
    } else {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: "Details do not match our records.",
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
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
              <TabsTrigger value="reset">Reset</TabsTrigger>
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
                <div className="text-xs text-center text-muted-foreground mt-2 space-y-1">
                  <p>Demo Admin: ID: <strong>Administrator</strong> / Mobile: <strong>1234567890</strong></p>
                  <p>Demo Student: ID: <strong>STU001</strong> / Mobile: <strong>9876543210</strong></p>
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

                {qrCodeUrl && (
                  <div className="flex flex-col items-center justify-center p-4 border rounded-md bg-muted/20">
                    <p className="text-sm font-semibold mb-2">Scan to Pay Registration Fee</p>
                    <img src={qrCodeUrl} alt="Payment QR Code" className="w-64 h-64 object-contain" />
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating Profile..." : "Create Profile"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label>Student ID</Label>
                  <Input value={resetId} onChange={e => setResetId(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <Input value={resetMobile} onChange={e => setResetMobile(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={resetCity} onChange={e => setResetCity(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" value={resetNewPass} onChange={e => setResetNewPass(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Processing..." : "Reset Password"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4 bg-muted/10">
          <p className="text-xs text-center text-muted-foreground italic">
            "Empowering students with professional typing and shorthand skills through structured practice and comprehensive assessments."
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
