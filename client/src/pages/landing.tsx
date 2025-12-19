import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth, useGallery, useSelectedCandidates } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Keyboard, FileText, Award, Image as ImageIcon, Phone, Mail, MapPin, Send, Youtube, Smartphone, Users, BookOpen, Trophy, GraduationCap, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import heroImage from "@assets/generated_images/modern_professional_typing_institute_classroom.png";
import logoImage from "@assets/WhatsApp_Image_2025-12-12_at_7.30.52_PM_(1)_1765980168956.jpeg";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import Autoplay from "embla-carousel-autoplay";
import { useToast } from "@/hooks/use-toast";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export default function LandingPage() {
  const { user: currentUser } = useAuth();
  const { images: galleryImages } = useGallery();
  const { candidates: selectedCandidates } = useSelectedCandidates();
  const { toast } = useToast();
  
  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`
    });
  };

  const getStartedLink = currentUser 
    ? (currentUser.role === 'admin' ? '/admin' : '/student') 
    : '/auth';

  return (
    <div className="flex flex-col min-h-screen">
      {/* Main Header/Navigation */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-primary/20 shadow-md bg-white shrink-0">
              <img src={logoImage} alt="Pragati Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-xs sm:text-sm md:text-lg text-gray-900 leading-tight">
                <span className="hidden sm:inline">Pragati Institute of Professional Studies</span>
                <span className="sm:hidden">Pragati Institute<br/>of Professional Studies</span>
              </h1>
              <p className="text-xs text-muted-foreground">Prayagraj</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden lg:flex items-center gap-6">
              <a href="#about" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">About</a>
              <a href="#candidates" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">Candidates</a>
              <Link href="/gallery" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">Gallery</Link>
              <Link href="/contact" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">Contact Us</Link>
            </nav>
            
            {/* Mobile Menu */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <div className="flex flex-col gap-4 mt-8">
                    <a href="#about" className="text-lg font-medium text-gray-700 hover:text-primary transition-colors py-2 border-b">About</a>
                    <a href="#candidates" className="text-lg font-medium text-gray-700 hover:text-primary transition-colors py-2 border-b">Candidates</a>
                    <Link href="/gallery" className="text-lg font-medium text-gray-700 hover:text-primary transition-colors py-2 border-b">Gallery</Link>
                    <Link href="/contact" className="text-lg font-medium text-gray-700 hover:text-primary transition-colors py-2 border-b">Contact Us</Link>
                    <Link href={getStartedLink}>
                      <Button className="w-full bg-gradient-to-r from-primary to-blue-600 mt-4">
                        {currentUser ? "Dashboard" : "Login"}
                      </Button>
                    </Link>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            
            <Link href={getStartedLink} className="hidden lg:block">
              <Button className="bg-gradient-to-r from-primary to-blue-600 shadow-md hover:shadow-lg transition-all">
                {currentUser ? "Dashboard" : "Login"}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Contact Bar - Below Header */}
      <div className="w-full bg-gray-900 text-gray-300 py-1.5 px-4 text-xs">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div 
              className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
              onClick={() => copyToClipboard('+91 9026212705', 'Phone number')}
            >
              <Phone className="h-3 w-3" />
              <span>+91 9026212705</span>
            </div>
            <div 
              className="hidden md:flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors"
              onClick={() => copyToClipboard('pragatiprofessionalstudies@gmail.com', 'Email')}
            >
              <Mail className="h-3 w-3" />
              <span>pragatiprofessionalstudies@gmail.com</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10 hover:text-white" onClick={() => openLink('https://t.me/pragatishorthand_2008')} title="Telegram">
              <Send className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10 hover:text-white" onClick={() => openLink('https://instagram.com/pragati_shorthand?igsh=NXJidTkzYW9sYjI=')} title="Instagram">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10 hover:text-white" onClick={() => openLink('https://youtube.com/@pragatistenohublive')} title="YouTube">
              <Youtube className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white/10 hover:text-white" onClick={() => openLink('https://gbolton.page.link/ZS5v')} title="Download App">
              <Smartphone className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="w-full py-16 md:py-24 lg:py-32 bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex justify-center text-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-4 h-4 bg-primary/40 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-orange-400/40 rounded-full animate-pulse delay-300" />
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-green-400/40 rounded-full animate-pulse delay-500" />
        
        <div className="container px-4 md:px-6 relative z-10">
          <div className="flex flex-col items-center gap-8">
            {/* Main Hero Content */}
            <div className="flex-1 flex flex-col items-center space-y-4 max-w-4xl">
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl bg-gradient-to-r from-gray-900 via-primary to-blue-800 bg-clip-text text-transparent">
                  Master Shorthand & Typing with Pragati
                </h1>
                <p className="max-w-[700px] mx-auto text-muted-foreground md:text-xl leading-relaxed">
                  Professional assessment platform for stenography and typing skills. Join thousands of students achieving excellence.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <span className="bg-gradient-to-r from-primary to-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide shadow-md">
                    Since 2008
                  </span>
                  <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-semibold">
                    5000+ Students
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 min-[400px]:flex-row justify-center pt-6">
                <Link href={getStartedLink}>
                  <Button size="lg" className="px-8 h-12 text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all bg-gradient-to-r from-primary to-blue-600 border-0">
                    {currentUser ? "Go to Dashboard" : "Get Started"} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/gallery">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-base border-2 hover:bg-primary/5">
                    <ImageIcon className="mr-2 h-5 w-5" /> View Gallery
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="relative mt-8 w-full max-w-5xl">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-blue-400/20 to-indigo-400/20 rounded-2xl blur-xl" />
              <img
                src={heroImage}
                alt="Hero"
                className="relative mx-auto aspect-video overflow-hidden rounded-2xl object-cover object-center w-full shadow-2xl border-4 border-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="w-full py-12 bg-gradient-to-r from-primary via-blue-600 to-indigo-600 text-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-white/10 rounded-full mb-3">
                <Users className="h-8 w-8" />
              </div>
              <div className="text-3xl md:text-4xl font-bold">5000+</div>
              <div className="text-sm opacity-90">Students Trained</div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-white/10 rounded-full mb-3">
                <Trophy className="h-8 w-8" />
              </div>
              <div className="text-3xl md:text-4xl font-bold">500+</div>
              <div className="text-sm opacity-90">Govt. Job Selections</div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-white/10 rounded-full mb-3">
                <BookOpen className="h-8 w-8" />
              </div>
              <div className="text-3xl md:text-4xl font-bold">17+</div>
              <div className="text-sm opacity-90">Years Experience</div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="p-3 bg-white/10 rounded-full mb-3">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div className="text-3xl md:text-4xl font-bold">100%</div>
              <div className="text-sm opacity-90">Dedication</div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="w-full py-16 md:py-24 bg-gradient-to-b from-white to-slate-50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">What We Offer</span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">About Pragati Institute</h2>
            <p className="max-w-[900px] mx-auto text-muted-foreground md:text-lg leading-relaxed">
              Pragati Professional Studies is dedicated to providing top-tier training and assessment in shorthand and typing. 
              Our platform offers realistic test environments, detailed performance analytics, and comprehensive study materials.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl items-stretch gap-8 py-12 lg:grid-cols-3">
            <Card className="shadow-lg border-0 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white group">
              <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="p-5 bg-gradient-to-br from-orange-100 to-orange-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Keyboard className="h-10 w-10 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold">Typing Mastery</h3>
                <p className="text-center text-muted-foreground leading-relaxed">
                  Practice with timed tests, real-time feedback, and word-based error tracking.
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white group">
              <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="p-5 bg-gradient-to-br from-red-100 to-red-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-10 w-10 text-red-500" />
                </div>
                <h3 className="text-xl font-bold">Shorthand Dictation</h3>
                <p className="text-center text-muted-foreground leading-relaxed">
                  Audio-based transcription tests designed to mimic real-world exam conditions.
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-lg border-0 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white group">
              <CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
                <div className="p-5 bg-gradient-to-br from-green-100 to-green-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <Award className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-center">Computer Teaching & Certification</h3>
                <p className="text-center text-muted-foreground leading-relaxed">
                  Track your progress and earn recognition for your speed and accuracy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Selected Candidates Section */}
      <section id="candidates" className="w-full py-16 md:py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="container px-4 md:px-6 mx-auto">
           <div className="text-center mb-12">
             <span className="text-primary font-semibold text-sm uppercase tracking-wider">Success Stories</span>
             <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mt-2">Our Selected Candidates</h2>
           </div>
           <div className="max-w-6xl mx-auto px-12">
             <Carousel
               plugins={[Autoplay({ delay: 3000 })]}
               className="w-full"
             >
               <CarouselContent className="-ml-4">
                 {selectedCandidates.map((student, idx) => (
                   <CarouselItem key={idx} className="pl-4 md:basis-1/3 lg:basis-1/4">
                     <div className="p-1">
                       <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-b from-white to-blue-50/50 group hover:-translate-y-1">
                         <CardContent className="flex flex-col items-center p-6 text-center">
                           <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-primary/20 shadow-lg mb-4 bg-gray-100 group-hover:border-primary/40 transition-colors">
                             <img src={student.imageUrl} alt={student.name} className="h-full w-full object-cover" />
                           </div>
                           <h3 className="font-bold text-lg text-primary">{student.name}</h3>
                           <p className="text-sm font-medium text-gray-600 mt-1">{student.designation}</p>
                           <p className="text-xs text-muted-foreground mt-3 bg-white px-4 py-1.5 rounded-full border shadow-sm">Batch {student.year}</p>
                         </CardContent>
                       </Card>
                     </div>
                   </CarouselItem>
                 ))}
               </CarouselContent>
               <CarouselPrevious className="border-2" />
               <CarouselNext className="border-2" />
             </Carousel>
             {selectedCandidates.length > 4 && (
               <div className="flex justify-center mt-10">
                 <Link href="/selected-candidates">
                   <Button variant="outline" size="lg" className="border-2">View All Selected Candidates</Button>
                 </Link>
               </div>
             )}
           </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="w-full py-16 md:py-24 bg-gradient-to-b from-white to-slate-50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-12">
            <span className="text-primary font-semibold text-sm uppercase tracking-wider">Our Moments</span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mt-2">Photo Gallery</h2>
          </div>
          {galleryImages.length > 0 ? (
            <div className="w-full max-w-5xl mx-auto px-12">
              <Carousel
                plugins={[
                  Autoplay({
                    delay: 2000,
                  }),
                ]}
                className="w-full"
              >
                <CarouselContent>
                  {galleryImages.map((url, idx) => (
                    <CarouselItem key={idx} className="md:basis-1/2 lg:basis-1/3">
                      <div className="p-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="relative group aspect-square rounded-xl overflow-hidden cursor-pointer shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] bg-white p-1">
                              <img src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover rounded-lg" />
                              <div className="absolute inset-1 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg" />
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                            <img src={url} alt={`Gallery ${idx}`} className="w-full h-auto max-h-[90vh] object-contain rounded-md" />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="border-2" />
                <CarouselNext className="border-2" />
              </Carousel>
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-lg border-2 border-dashed">
              <p className="text-muted-foreground">No images uploaded yet.</p>
            </div>
          )}
          {galleryImages.length > 0 && (
            <div className="mt-10 text-center">
              <Link href="/gallery">
                 <Button variant="outline" size="lg" className="border-2">View All Images</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="w-full py-12 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center md:items-start">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white">
                  <img src={logoImage} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Pragati Institute</h3>
                  <p className="text-sm text-gray-400">Professional Studies</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 text-center md:text-left">
                Empowering students with professional typing and shorthand skills since 2008.
              </p>
            </div>
            
            <div className="flex flex-col items-center">
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <div className="flex flex-col gap-2 text-sm text-gray-400">
                <Link href="/auth" className="hover:text-white transition-colors">Student Login</Link>
                <Link href="/gallery" className="hover:text-white transition-colors">Photo Gallery</Link>
                <Link href="/selected-candidates" className="hover:text-white transition-colors">Selected Candidates</Link>
              </div>
            </div>
            
            <div className="flex flex-col items-center md:items-end">
              <h4 className="font-semibold mb-4">Contact Us</h4>
              <div className="flex flex-col gap-2 text-sm text-gray-400 text-center md:text-right">
                <p>+91 9026212705</p>
                <p>pragatiprofessionalstudies@gmail.com</p>
                <p>Kalindipuram, Prayagraj, 211011</p>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/10" onClick={() => openLink('https://t.me/pragatishorthand_2008')}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/10" onClick={() => openLink('https://youtube.com/@pragatistenohublive')}>
                  <Youtube className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/10" onClick={() => openLink('https://gbolton.page.link/ZS5v')}>
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Pragati Institute of Professional Studies. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
