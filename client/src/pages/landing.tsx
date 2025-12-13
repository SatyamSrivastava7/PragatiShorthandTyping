import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Keyboard, FileText, Award, Image as ImageIcon } from "lucide-react";
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
  const { galleryImages } = useMockStore();
  
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-background flex justify-center text-center">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                Master Shorthand & Typing with Pragati
              </h1>
              <p className="max-w-[600px] mx-auto text-muted-foreground md:text-xl">
                Professional assessment platform for stenography and typing skills. Join thousands of students achieving excellence.
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