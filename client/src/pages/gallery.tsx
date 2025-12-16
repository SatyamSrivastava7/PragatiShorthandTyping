import { useGallery } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export default function GalleryPage() {
  const { images: galleryImages } = useGallery();

  return (
    <div className="container px-4 md:px-6 py-12 mx-auto">
      <h1 className="text-4xl font-bold text-center mb-4">Photo Gallery</h1>
      <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
        Glimpses of life and events at Pragati Institute of Professional Studies.
      </p>
      
      {galleryImages.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {galleryImages.map((url, idx) => (
            <Dialog key={idx}>
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
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground">No images uploaded yet.</p>
        </div>
      )}
    </div>
  );
}