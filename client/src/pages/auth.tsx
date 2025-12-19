import { useState } from "react";
import { useAuth } from "@/lib/hooks";
import { useSettings } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, QrCode, CheckCircle, AlertCircle } from "lucide-react";

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

  // Payment Verification State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<{
    name: string;
    mobile: string;
    password: string;
    batch: string;
    email?: string;
    city: string;
    state: string;
  } | null>(null);

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

  const validateRegistration = () => {
    if (regMobile.length !== 10) {
       toast({
        variant: "destructive",
        title: "Invalid Mobile",
        description: "Mobile number must be 10 digits.",
      });
      return false;
    }

    if (!regName.trim()) {
      toast({
        variant: "destructive",
        title: "Name Required",
        description: "Please enter your full name.",
      });
      return false;
    }

    if (!regPassword.trim()) {
      toast({
        variant: "destructive",
        title: "Password Required",
        description: "Please create a password.",
      });
      return false;
    }

    if (!regCity.trim()) {
      toast({
        variant: "destructive",
        title: "City Required",
        description: "Please enter your city.",
      });
      return false;
    }

    if (!regState.trim()) {
      toast({
        variant: "destructive",
        title: "State Required",
        description: "Please enter your state.",
      });
      return false;
    }

    if (!regBatch.trim()) {
      toast({
        variant: "destructive",
        title: "Batch Required",
        description: "Please enter your batch (e.g., 2024-25).",
      });
      return false;
    }

    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRegistration()) {
      return;
    }

    // Check if payment verification is required
    if (settings?.requirePaymentVerification) {
      // Store pending registration data and show payment modal
      setPendingRegistration({
        name: regName.trim(),
        mobile: regMobile,
        password: regPassword,
        batch: regBatch.trim(),
        email: regEmail || undefined,
        city: regCity.trim(),
        state: regState.trim(),
      });
      setShowPaymentModal(true);
      return;
    }

    // If no payment verification required, proceed directly
    await completeRegistration({
      name: regName.trim(),
      mobile: regMobile,
      password: regPassword,
      batch: regBatch.trim(),
      email: regEmail || undefined,
      city: regCity.trim(),
      state: regState.trim(),
    });
  };

  const completeRegistration = async (data: {
    name: string;
    mobile: string;
    password: string;
    batch: string;
    email?: string;
    city: string;
    state: string;
  }, paymentConfirmed: boolean = false) => {
    try {
      const result = await register({ ...data, paymentConfirmed });
      
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
        setLoginMobile(data.mobile);
        setLoginPassword(data.password);
        setActiveTab("login");
      }
      
      // Close payment modal if open
      setShowPaymentModal(false);
      setPendingRegistration(null);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: err.message || "Failed to create account. Please try again.",
      });
    }
  };

  const handlePaymentConfirm = async () => {
    if (!pendingRegistration) return;
    await completeRegistration(pendingRegistration, true);
  };

  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
    setPendingRegistration(null);
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
            <TabsList className="grid w-full grid-cols-3 mb-4 bg-white shadow-md border p-1.5 rounded-xl h-auto">
              <TabsTrigger 
                value="login"
                className="rounded-lg py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white text-gray-600 data-[state=active]:shadow-md transition-all font-medium"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="register"
                className="rounded-lg py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white text-gray-600 data-[state=active]:shadow-md transition-all font-medium"
              >
                New Student
              </TabsTrigger>
              <TabsTrigger 
                value="reset"
                className="rounded-lg py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-gray-600 data-[state=active]:shadow-md transition-all font-medium"
              >
                Reset
              </TabsTrigger>
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
                  <p>Demo User: Mobile: <strong>9876543210</strong> / Password: <strong>demo123</strong></p>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="regName">Full Name <span className="text-destructive">*</span></Label>
                  <Input id="regName" value={regName} onChange={e => setRegName(e.target.value)} placeholder="Enter your full name" required data-testid="input-register-name" />
                </div>
               
                <div className="space-y-2">
                  <Label htmlFor="regMobile">Mobile Number (10 digits) <span className="text-destructive">*</span></Label>
                  <Input 
                    id="regMobile" 
                    maxLength={10} 
                    placeholder="Enter 10-digit mobile number"
                    value={regMobile} 
                    onChange={e => setRegMobile(e.target.value.replace(/\D/g, ''))} 
                    required 
                    data-testid="input-register-mobile"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="regPassword">Password <span className="text-destructive">*</span></Label>
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
                    <Label htmlFor="regCity">City <span className="text-destructive">*</span></Label>
                    <Input id="regCity" value={regCity} onChange={e => setRegCity(e.target.value)} placeholder="Enter your city" required data-testid="input-register-city" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regState">State <span className="text-destructive">*</span></Label>
                    <Input id="regState" value={regState} onChange={e => setRegState(e.target.value)} placeholder="Enter your state" required data-testid="input-register-state" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="regBatch">Batch <span className="text-destructive">*</span></Label>
                    <Input id="regBatch" value={regBatch} onChange={e => setRegBatch(e.target.value)} placeholder="e.g., 2024-25" required data-testid="input-register-batch" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regEmail">Email (Optional)</Label>
                    <Input id="regEmail" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} data-testid="input-register-email" />
                  </div>
                </div>

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

      {/* Payment Verification Modal */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => !open && handlePaymentCancel()}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-payment-verification">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Payment Required
            </DialogTitle>
            <DialogDescription>
              Please complete the payment to create your profile. Scan the QR code below with any UPI app.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-4">
            {/* Registration Fee Amount */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Registration Fee</p>
              <p className="text-3xl font-bold text-primary" data-testid="text-payment-amount">
                ₹{settings?.registrationFee || 0}
              </p>
            </div>

            {/* QR Code */}
            {settings?.qrCodeUrl ? (
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 bg-white">
                <img 
                  src={settings.qrCodeUrl} 
                  alt="Payment QR Code" 
                  className="w-48 h-48 object-contain"
                  data-testid="img-payment-qr"
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 bg-muted/20 flex flex-col items-center justify-center">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground text-center">
                  QR Code not available. Please contact administrator.
                </p>
              </div>
            )}

            {/* UPI ID */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">UPI ID</p>
              <p className="font-mono text-sm bg-muted px-3 py-1 rounded" data-testid="text-upi-id">
                pragatiinstiute@sbi
              </p>
            </div>

            {/* Instructions */}
            <div className="text-sm text-muted-foreground text-center space-y-1">
              <p>1. Scan QR code or use UPI ID</p>
              <p>2. Pay ₹{settings?.registrationFee || 0}</p>
              <p>3. Click "I have paid" after payment</p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handlePaymentCancel}
              disabled={isRegistering}
              data-testid="button-payment-cancel"
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePaymentConfirm}
              disabled={isRegistering}
              className="bg-gradient-to-r from-green-600 to-green-500"
              data-testid="button-payment-confirm"
            >
              {isRegistering ? (
                <>Creating Profile...</>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  I have paid
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
