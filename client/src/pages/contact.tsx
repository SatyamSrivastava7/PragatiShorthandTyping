import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, Send, Instagram, Facebook, Youtube, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="container px-4 md:px-6 py-12 mx-auto">
      <h1 className="text-4xl font-bold text-center mb-12">Contact Us</h1>
      
      <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Get in Touch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary group-hover:text-white transition-colors">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Email</h3>
                <p className="text-sm text-muted-foreground">pragatiprofessionalstudies@gmail.com</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary group-hover:text-white transition-colors">
                <Phone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Phone</h3>
                <p className="text-sm text-muted-foreground">+91 9026212705</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 group cursor-pointer">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary group-hover:text-white transition-colors">
                <MapPin className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Address</h3>
                <p className="text-sm text-muted-foreground">
                  Kalindipuram, Rajrooppur, Prayagraj, Uttar Pradesh, India, 211011
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connect With Us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">Follow us on social media for updates and study materials.</p>
            
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200" onClick={() => openLink('https://web.telegram.org/a/@pragatistenohublive')}>
                <Send className="h-5 w-5 text-blue-500" /> Telegram
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200" onClick={() => openLink('https://instagram.com/pragati_shorthand?igsh=NXJidTkzYW9sYjI=')}>
                <Instagram className="h-5 w-5 text-pink-600" /> Instagram
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200" onClick={() => openLink('https://facebook.com/pragati.shorthand.3')}>
                <Facebook className="h-5 w-5 text-blue-700" /> Facebook
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-red-50 hover:text-red-600 hover:border-red-200" onClick={() => openLink('https://youtube.com/@pragatistenohublive')}>
                <Youtube className="h-5 w-5 text-red-600" /> Stenographers' Hub
              </Button>
               <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-red-50 hover:text-red-600 hover:border-red-200" onClick={() => openLink('https://youtube.com/@pragatidictationhub?si=ogoVJalxwkufcYyB')}>
                <Youtube className="h-5 w-5 text-red-600" /> Dictations Hub
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-12 hover:bg-green-50 hover:text-green-600 hover:border-green-200" onClick={() => openLink('https://gbolton.page.link/ZS5v')}>
                <Smartphone className="h-5 w-5 text-green-600" /> Classes App
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
