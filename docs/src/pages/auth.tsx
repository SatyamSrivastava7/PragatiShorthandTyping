import { useState } from "react";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCircle2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const { login } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = (role: "admin" | "user") => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to continue",
        variant: "destructive",
      });
      return;
    }

    login(username, role);
    toast({
      title: `Welcome back, ${username}!`,
      description: `Logged in as ${role}`,
    });

    if (role === "admin") {
      setLocation("/admin");
    } else {
      setLocation("/dashboard");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 bg-primary rounded-xl mx-auto flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg shadow-primary/20">
            P
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Pragati Shorthand and Typing</h1>
          <p className="text-muted-foreground">Official Testing Portal</p>
        </div>

        <Card className="border-muted shadow-xl">
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>Select your role to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="user" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="user" className="gap-2">
                  <UserCircle2 className="h-4 w-4" /> Student
                </TabsTrigger>
                <TabsTrigger value="admin" className="gap-2">
                  <ShieldCheck className="h-4 w-4" /> Admin
                </TabsTrigger>
              </TabsList>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter your name or ID"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-muted/30"
                  />
                </div>
              </div>

              <div className="mt-6">
                <TabsContent value="user">
                  <Button className="w-full" size="lg" onClick={() => handleLogin("user")}>
                    Start Test
                  </Button>
                </TabsContent>
                <TabsContent value="admin">
                  <Button className="w-full" size="lg" onClick={() => handleLogin("admin")}>
                    Access Admin Dashboard
                  </Button>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
          <CardFooter className="justify-center border-t bg-muted/10 py-4">
            <p className="text-xs text-muted-foreground text-center">
              By logging in, you agree to the institute's academic integrity policy.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
