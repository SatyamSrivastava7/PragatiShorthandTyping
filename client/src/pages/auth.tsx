import { useState } from "react";
import { useAuth } from "@/lib/hooks";
import { useSettings } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const { login, register, resetPassword, isLoggingIn, isRegistering } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("login");

  // Login State
  const [loginMobile, setLoginMobile] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Register State
  const [regName, setRegName] = useState("");
  const [regMobile, setRegMobile] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regBatch, setRegBatch] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCity, setRegCity] = useState("");
  const [regState, setRegState] = useState("");

  // Reset Password State
  const [resetStudentId, setResetStudentId] = useState("");
  const [resetMobile, setResetMobile] = useState("");
  const [resetCity, setResetCity] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login({ mobile: loginMobile, password: loginPassword });
      toast({
        title: "Welcome back!",
        description: "Successfully logged in.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid credentials. Please check your mobile number and password.",
      });
    }
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

    try {
      const result = await register({
        name: regName,
        mobile: regMobile,
        password: regPassword,
        batch: regBatch || undefined,
        email: regEmail || undefined,
        city: regCity || undefined,
        state: regState || undefined,
      });
      
      // Show success message for pending approval
      if (result.pendingApproval) {
        toast({
          title: "Profile Created Successfully!",
          description: `Your Student ID is ${result.studentId}. Please contact the administrator to activate your account before you can log in.`,
          duration: 10000,
        });
        // Clear form and switch to login tab
        setRegName("");
        setRegMobile("");
        setRegPassword("");
        setRegBatch("");
        setRegEmail("");
        setRegCity("");
        setRegState("");
        setActiveTab("login");
      } else {
        toast({
          title: "Registration Successful",
          description: "Your account has been created. You can now login.",
        });
        setLoginMobile(regMobile);
        setLoginPassword(regPassword);
        setActiveTab("login");
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: err.message || "Failed to create account. Please try again.",
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await resetPassword({
        studentId: resetStudentId,
        mobile: resetMobile,
        city: resetCity,
        newPassword: resetNewPass,
      });
      
      toast({
        title: "Password Reset Successful",
        description: "You can now login with your new password.",
      });
      setLoginMobile(resetMobile);
      setLoginPassword(resetNewPass);
      setActiveTab("login");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: error.message || "Details do not match our records.",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/4 w-4 h-4 bg-primary/40 rounded-full animate-pulse" />
      <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-orange-400/40 rounded-full animate-pulse" />
      <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-green-400/40 rounded-full animate-pulse" />
      
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary relative z-10 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Pragati Institute</CardTitle>
          <CardDescription>Shorthand & Typing Assessment Platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">New Student Signup</TabsTrigger>
              <TabsTrigger value="reset">Reset</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loginMobile">Mobile Number</Label>
                  <Input 
                    id="loginMobile" 
                    placeholder="Enter 10-digit Mobile No." 
                    value={loginMobile}
                    onChange={(e) => setLoginMobile(e.target.value)}
                    required
                    data-testid="input-login-mobile"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginPassword">Password</Label>
                  <div className="relative">
                    <Input 
                      id="loginPassword" 
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password" 
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      data-testid="input-login-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-blue-600 shadow-md hover:shadow-lg transition-all" disabled={isLoggingIn} data-testid="button-login">
                  {isLoggingIn ? "Logging in..." : "Login"}
                </Button>
                <div className="text-center">
                   <Button 
                     type="button" 
                     variant="link" 
                     className="text-xs text-muted-foreground hover:text-primary hover:underline p-0 h-auto"
                     onClick={() => setActiveTab("reset")}
                     data-testid="button-forgot-password"
                   >
                     Forgot Password?
                   </Button>
                </div>
                <div className="text-xs text-center text-muted-foreground mt-2 space-y-1">
                  <p>Demo Admin: Mobile: <strong>9876543210</strong> / Password: <strong>demo123</strong></p>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="regName">Full Name</Label>
                  <Input id="regName" value={regName} onChange={e => setRegName(e.target.value)} required data-testid="input-register-name" />
                </div>
               
                <div className="space-y-2">
                  <Label htmlFor="regMobile">Mobile Number (10 digits)</Label>
                  <Input 
                    id="regMobile" 
                    maxLength={10} 
                    value={regMobile} 
                    onChange={e => setRegMobile(e.target.value.replace(/\D/g, ''))} 
                    required 
                    data-testid="input-register-mobile"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="regPassword">Password</Label>
                  <div className="relative">
                    <Input 
                      id="regPassword" 
                      type={showRegPassword ? "text" : "password"}
                      placeholder="Create a password" 
                      value={regPassword} 
                      onChange={e => setRegPassword(e.target.value)} 
                      required 
                      data-testid="input-register-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      data-testid="button-toggle-register-password"
                    >
                      {showRegPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regCity">City</Label>
                    <Input id="regCity" value={regCity} onChange={e => setRegCity(e.target.value)} data-testid="input-register-city" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regState">State</Label>
                    <Input id="regState" value={regState} onChange={e => setRegState(e.target.value)} data-testid="input-register-state" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regBatch">Batch (Optional)</Label>
                    <Input id="regBatch" value={regBatch} onChange={e => setRegBatch(e.target.value)} data-testid="input-register-batch" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regEmail">Email (Optional)</Label>
                    <Input id="regEmail" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} data-testid="input-register-email" />
                  </div>
                </div>

                {(settings?.showRegistrationFee || settings?.showQrCode) && (
                  <div className="flex flex-col items-center justify-center p-4 border rounded-md bg-muted/20">
                    <p className="text-sm font-semibold mb-1">Scan to Pay Registration Fee</p>
                    {settings?.showRegistrationFee && settings.registrationFee > 0 && (
                      <p className="text-lg font-bold text-primary mb-2">Rs. {settings.registrationFee}/-</p>
                    )}
                    {settings?.showQrCode && settings?.qrCodeUrl && (
                      <img src={settings.qrCodeUrl} alt="Payment QR Code" className="w-64 h-64 object-contain" />
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-blue-600 shadow-md hover:shadow-lg transition-all" disabled={isRegistering} data-testid="button-register">
                  {isRegistering ? "Creating Profile..." : "Create Profile"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset">
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label>Student ID</Label>
                  <Input value={resetStudentId} onChange={e => setResetStudentId(e.target.value)} required data-testid="input-reset-student-id" />
                </div>
                <div className="space-y-2">
                  <Label>Mobile Number</Label>
                  <Input value={resetMobile} onChange={e => setResetMobile(e.target.value)} required data-testid="input-reset-mobile" />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={resetCity} onChange={e => setResetCity(e.target.value)} required data-testid="input-reset-city" />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" placeholder="Enter new password" value={resetNewPass} onChange={e => setResetNewPass(e.target.value)} required data-testid="input-reset-password" />
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-blue-600 shadow-md hover:shadow-lg transition-all" data-testid="button-reset-password">
                  Reset Password
                </Button>
                <div className="text-center">
                   <Button 
                     type="button" 
                     variant="link" 
                     className="text-xs text-muted-foreground hover:text-primary hover:underline p-0 h-auto"
                     onClick={() => setActiveTab("login")}
                     data-testid="button-back-to-login"
                   >
                     Back to Login
                   </Button>
                </div>
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
