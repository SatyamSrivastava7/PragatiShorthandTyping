import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Keyboard, FileText, Award, Image as ImageIcon, Phone, Mail, MapPin, Facebook, Instagram, Twitter, Send, Youtube, Smartphone } from "lucide-react";
import heroImage from "@assets/generated_images/modern_professional_typing_institute_classroom.png";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export default function LandingPage() {
  const { galleryImages, selectedCandidates } = useMockStore();
  
  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-background flex justify-center text-center relative overflow-hidden">
        
        <div className="container px-4 md:px-6 relative z-10">
          <div className="flex flex-col xl:flex-row items-center gap-12">
            
            {/* Connect Section - Left Aligned */}
            <div className="hidden xl:flex flex-col w-72 shrink-0 text-left space-y-6">
               <Card className="border-l-4 border-l-primary shadow-lg bg-white/95 backdrop-blur">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Connect With Us</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-primary/10 rounded-full"><Phone className="h-4 w-4 text-primary"/></div>
                       <div><p className="font-medium">Phone</p><p className="text-muted-foreground text-xs">+91 9026212705</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-primary/10 rounded-full"><Mail className="h-4 w-4 text-primary"/></div>
                       <div><p className="font-medium">Email</p><p className="text-muted-foreground text-xs truncate w-32">pragatiprofessionalstudies@gmail.com</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-primary/10 rounded-full"><MapPin className="h-4 w-4 text-primary"/></div>
                       <div><p className="font-medium">Address</p><p className="text-muted-foreground text-xs">Rajrooppur, Prayagraj</p></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Button variant="outline" size="sm" className="w-full justify-start h-8 px-2 text-xs" onClick={() => openLink('https://web.telegram.org/a/@pragatistenohublive')}>
                        <Send className="h-3 w-3 mr-1 text-blue-500" /> Telegram
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start h-8 px-2 text-xs" onClick={() => openLink('https://instagram.com/pragati_shorthand?igsh=NXJidTkzYW9sYjI=')}>
                        <Instagram className="h-3 w-3 mr-1 text-pink-600" /> Insta
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start h-8 px-2 text-xs" onClick={() => openLink('https://youtube.com/@pragatistenohublive')}>
                        <Youtube className="h-3 w-3 mr-1 text-red-600" /> Steno Hub
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start h-8 px-2 text-xs" onClick={() => openLink('https://gbolton.page.link/ZS5v')}>
                        <Smartphone className="h-3 w-3 mr-1 text-green-600" /> App
                      </Button>
                    </div>
                  </CardContent>
               </Card>
            </div>

            {/* Main Hero Content */}
            <div className="flex-1 flex flex-col items-center space-y-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                  Master Shorthand & Typing with Pragati
                </h1>
                <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
                  Professional assessment platform for stenography and typing skills. Join thousands of students achieving excellence.
                </p>
                <p className="text-sm font-semibold text-primary/80 uppercase tracking-widest mt-4">
                  Established in 2008
                </p>
              </div>
              <div className="flex flex-col gap-2 min-[400px]:flex-row justify-center">
                <Link href="/auth">
                  <Button size="lg" className="px-8">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/gallery">
                  <Button variant="outline" size="lg">
                    <ImageIcon className="mr-2 h-4 w-4" /> View Gallery
                  </Button>
                </Link>
              </div>
              <img
                src={heroImage}
                alt="Hero"
                className="mx-auto mt-8 aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full max-w-4xl shadow-2xl"
              />
            </div>
            
             {/* Right Spacer for Balance on XL screens */}
             <div className="hidden xl:block w-72 shrink-0"></div>
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
                             <img src={student.image} alt={student.name} className="h-full w-full object-cover" />
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