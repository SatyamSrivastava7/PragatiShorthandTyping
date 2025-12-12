import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Keyboard, FileText, Award, Users } from "lucide-react";
import heroImage from "@assets/generated_images/modern_professional_typing_institute_classroom.png"; // Will be generated

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-background">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
            <div className="flex flex-col justify-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                  Master Shorthand & Typing with Pragati
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl">
                  Professional assessment platform for stenography and typing skills. Join thousands of students achieving excellence.
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link href="/auth">
                  <Button size="lg" className="px-8">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" size="lg">
                    Contact Us
                  </Button>
                </Link>
              </div>
            </div>
            <img
              src={heroImage}
              alt="Hero"
              className="mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full lg:order-last"
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">About Pragati Institute</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Pragati Professional Studies is dedicated to providing top-tier training and assessment in shorthand and typing. 
                Our platform offers realistic test environments, detailed performance analytics, and comprehensive study materials.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3">
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Keyboard className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Typing Mastery</h3>
                <p className="text-center text-muted-foreground">
                  Practice with timed tests, real-time feedback, and word-based error tracking.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Shorthand Dictation</h3>
                <p className="text-center text-muted-foreground">
                  Audio-based transcription tests designed to mimic real-world exam conditions.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6 space-y-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <Award className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Certification</h3>
                <p className="text-center text-muted-foreground">
                  Track your progress and earn recognition for your speed and accuracy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-8 text-center">Gallery</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-video relative overflow-hidden rounded-lg bg-muted">
                 <img 
                   src={`https://picsum.photos/seed/${i + 10}/600/400`} 
                   alt={`Gallery Image ${i}`}
                   className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
                 />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-6 bg-slate-900 text-white">
        <div className="container px-4 md:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
             <div className="space-y-4">
               <h4 className="text-lg font-bold">Pragati Institute</h4>
               <p className="text-sm text-slate-300">Empowering careers through skill development.</p>
             </div>
             <div className="space-y-4">
               <h4 className="text-lg font-bold">Contact</h4>
               <ul className="space-y-2 text-sm text-slate-300">
                 <li>pragatiprofessionalstudies@gmail.com</li>
                 <li>+91 9026212705</li>
               </ul>
             </div>
             <div className="space-y-4">
               <h4 className="text-lg font-bold">Address</h4>
               <p className="text-sm text-slate-300">
                 Lucknow, Uttar Pradesh, India
               </p>
             </div>
          </div>
          <div className="mt-8 border-t border-slate-800 pt-8 text-center text-xs text-slate-400">
            © 2024 Pragati Professional Studies. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
