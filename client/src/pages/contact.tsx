import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, Send, Instagram, Facebook, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  return (
    <div className="container px-4 md:px-6 py-12">
      <h1 className="text-4xl font-bold text-center mb-12">Contact Us</h1>
      
      <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Get in Touch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Email</h3>
                <p className="text-sm text-muted-foreground">pragatiprofessionalstudies@gmail.com</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Phone</h3>
                <p className="text-sm text-muted-foreground">+91 9026212705</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Address</h3>
                <p className="text-sm text-muted-foreground">Lucknow, Uttar Pradesh, India</p>
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
              <Button variant="outline" className="w-full justify-start gap-2 h-12">
                <Send className="h-5 w-5 text-blue-500" /> Telegram
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-12">
                <Instagram className="h-5 w-5 text-pink-600" /> Instagram
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-12">
                <Facebook className="h-5 w-5 text-blue-700" /> Facebook
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 h-12">
                <Youtube className="h-5 w-5 text-red-600" /> YouTube
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
