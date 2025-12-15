import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Keyboard, FileText, Award, Image as ImageIcon, Phone, Mail, MapPin, Facebook, Instagram, Twitter, Send, Youtube, Smartphone, Copy } from "lucide-react";
import heroImage from "@assets/generated_images/modern_professional_typing_institute_classroom.png";
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
  const { galleryImages, selectedCandidates, currentUser } = useMockStore();
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
      {/* Top Bar - Contact Info */}
      <div className="w-full bg-primary text-primary-foreground py-2 px-4 md:px-6">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-2 text-sm">
          <div className="flex flex-wrap justify-center md:justify-start gap-4 md:gap-6">
             <div 
               className="flex items-center gap-2 cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors group"
               onClick={() => copyToClipboard('+91 9026212705', 'Phone number')}
             >
               <Phone className="h-4 w-4" />
               <span className="group-hover:underline">+91 9026212705</span>
             </div>
             <div 
               className="flex items-center gap-2 cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors group"
               onClick={() => copyToClipboard('pragatiprofessionalstudies@gmail.com', 'Email')}
             >
               <Mail className="h-4 w-4" />
               <span className="group-hover:underline truncate max-w-[200px] md:max-w-none">pragatiprofessionalstudies@gmail.com</span>
             </div>
             <div className="hidden lg:flex items-center gap-2">
               <MapPin className="h-4 w-4" />
               <span>Rajrooppur, Prayagraj</span>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs opacity-90">Connect:</span>
            <div className="flex gap-2">
               <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/20 hover:text-white" onClick={() => openLink('https://web.telegram.org/a/@pragatistenohublive')} title="Telegram">
                 <Send className="h-4 w-4" />
               </Button>
               <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/20 hover:text-white" onClick={() => openLink('https://instagram.com/pragati_shorthand?igsh=NXJidTkzYW9sYjI=')} title="Instagram">
                 <Instagram className="h-4 w-4" />
               </Button>
               <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/20 hover:text-white" onClick={() => openLink('https://youtube.com/@pragatistenohublive')} title="YouTube">
                 <Youtube className="h-4 w-4" />
               </Button>
               <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/20 hover:text-white" onClick={() => openLink('https://gbolton.page.link/ZS5v')} title="Download App">
                 <Smartphone className="h-4 w-4" />
               </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-background flex justify-center text-center relative overflow-hidden">
        
        <div className="container px-4 md:px-6 relative z-10">
          <div className="flex flex-col items-center gap-8">
            
            {/* Main Hero Content */}
            <div className="flex-1 flex flex-col items-center space-y-4 max-w-4xl">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                  Master Shorthand & Typing with Pragati
                </h1>
                <p className="max-w-[700px] mx-auto text-muted-foreground md:text-xl">
                  Professional assessment platform for stenography and typing skills. Join thousands of students achieving excellence.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-semibold tracking-wide uppercase">
                    Since 2008
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center pt-4">
                <Link href={getStartedLink}>
                  <Button size="lg" className="px-8 h-12 text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                    {currentUser ? "Go to Dashboard" : "Get Started"} <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/gallery">
                  <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                    <ImageIcon className="mr-2 h-5 w-5" /> View Gallery
                  </Button>
                </Link>
              </div>
            </div>
            
            <img
              src={heroImage}
              alt="Hero"
              className="mx-auto mt-4 aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full max-w-5xl shadow-2xl border-4 border-white/50"
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">About Pragati Institute</h2>
              <p className="max-w-[900px] mx-auto text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
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
                <h3 className="text-xl font-bold">Computer Teaching & Certification</h3>
                <p className="text-center text-muted-foreground">
                  Track your progress and earn recognition for your speed and accuracy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Selected Candidates Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-background">
        <div className="container px-4 md:px-6 mx-auto">
           <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-12 text-center">Our Selected Candidates</h2>
           <div className="max-w-6xl mx-auto px-12">
             <Carousel
               plugins={[Autoplay({ delay: 3000 })]}
               className="w-full"
             >
               <CarouselContent className="-ml-4">
                 {selectedCandidates.map((student, idx) => (
                   <CarouselItem key={idx} className="pl-4 md:basis-1/3 lg:basis-1/4">
                     <div className="p-1">
                       <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-b from-white to-blue-50/50">
                         <CardContent className="flex flex-col items-center p-6 text-center">
                           <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-white shadow-md mb-4 bg-gray-100">
                             <img src={student.imageUrl} alt={student.name} className="h-full w-full object-cover" />
                           </div>
                           <h3 className="font-bold text-lg text-primary">{student.name}</h3>
                           <p className="text-sm font-medium text-gray-700 mt-1">{student.designation}</p>
                           <p className="text-xs text-muted-foreground mt-2 bg-white px-3 py-1 rounded-full border">Batch {student.year}</p>
                         </CardContent>
                       </Card>
                     </div>
                   </CarouselItem>
                 ))}
               </CarouselContent>
               <CarouselPrevious />
               <CarouselNext />
             </Carousel>
           </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6 mx-auto">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-8 text-center">Gallery</h2>
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
                      <div className="p-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
                              <img src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
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
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-lg border-2 border-dashed">
              <p className="text-muted-foreground">No images uploaded yet.</p>
            </div>
          )}
          {galleryImages.length > 0 && (
            <div className="mt-8 text-center">
              <Link href="/gallery">
                 <Button variant="outline">View All Images</Button>
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}